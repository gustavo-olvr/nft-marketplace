import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { REALTIME_PATH } from '@/config'
import type {
  Cart,
  Nft,
  NftListResponse,
  NftUpdatedEvent,
  OrderResponse,
  OrderUpdatedEvent,
} from '@/contracts'
import { cartKeys } from '@/features/cart/keys'
import { nftKeys } from '@/features/catalog/keys'
import { orderKeys } from '@/features/checkout/keys'
import { formatEth } from '@/lib/money'
import { emitSessionExpired } from '@/lib/session-events'
import { notify } from './notifications'
import { setRealtimeStatus } from './status'

const MAX_SEEN_EVENTS = 500

type IoFactory = typeof import('socket.io-client').io

const loadIo = async (): Promise<IoFactory> => (await import('socket.io-client')).io

export interface RealtimeConfig {
  queryClient: QueryClient
  url?: string
  io?: IoFactory
}

export interface RealtimeSession {
  token: string | null
  userId: string | null
}

export function createRealtime({ queryClient: qc, url, io }: RealtimeConfig) {
  let socket: Socket | null = null
  let epoch = 0
  let session: RealtimeSession = { token: null, userId: null }
  let connectedBefore = false
  const seenEvents = new Set<string>()
  const versions = new Map<string, number>()

  function accept(eventId: string) {
    if (seenEvents.has(eventId)) return false
    seenEvents.add(eventId)
    if (seenEvents.size > MAX_SEEN_EVENTS) {
      const oldest = seenEvents.values().next().value
      if (oldest !== undefined) seenEvents.delete(oldest)
    }
    return true
  }

  function findCachedNft(id: string): Nft | undefined {
    let best = qc.getQueryData<Nft>(nftKeys.detail(id))
    for (const [, data] of qc.getQueriesData<NftListResponse>({ queryKey: nftKeys.lists() })) {
      for (const item of data?.items ?? []) {
        if (item.id === id && (!best || item.version > best.version)) best = item
      }
    }
    return best
  }

  function announceNft(previous: Nft | undefined, next: Nft) {
    if (!previous) return
    const cart = qc.getQueryData<Cart>(cartKeys.all)
    const inCart = cart?.items.filter((item) => item.nftId === next.id) ?? []
    const watching =
      (qc
        .getQueryCache()
        .find({ queryKey: nftKeys.detail(next.id), exact: true })
        ?.getObserversCount() ?? 0) > 0
    if (inCart.length === 0 && !watching) return

    const editionIds = watching ? next.editions.map((e) => e.id) : inCart.map((item) => item.editionId)
    for (const editionId of new Set(editionIds)) {
      const before = previous.editions.find((e) => e.id === editionId)
      const after = next.editions.find((e) => e.id === editionId)
      if (!before || !after) continue
      const label = `${next.name} (${after.label})`
      if (before.price !== after.price) {
        notify(`O preço de ${label} mudou de ${formatEth(before.price)} para ${formatEth(after.price)}.`)
      }
      if (before.available !== after.available) {
        notify(
          after.available === 0
            ? `${label} esgotou.`
            : `A disponibilidade de ${label} mudou: agora há ${after.available} disponíveis.`,
        )
      }
    }
  }

  function onNftUpdated(event: NftUpdatedEvent) {
    if (!accept(event.eventId)) return
    const nft = event.data
    const key = `nft:${nft.id}`
    const previous = findCachedNft(nft.id)
    const known = Math.max(versions.get(key) ?? 0, previous?.version ?? 0)
    if (event.version <= known) return
    versions.set(key, event.version)

    qc.setQueryData<Nft>(nftKeys.detail(nft.id), (old) => (old && nft.version > old.version ? nft : old))
    qc.setQueriesData<NftListResponse>({ queryKey: nftKeys.lists() }, (old) =>
      old
        ? {
            ...old,
            items: old.items.map((item) => (item.id === nft.id && nft.version > item.version ? nft : item)),
          }
        : old,
    )

    const cart = qc.getQueryData<Cart>(cartKeys.all)
    if (cart?.items.some((item) => item.nftId === nft.id)) {
      qc.invalidateQueries({ queryKey: cartKeys.quotes, refetchType: 'active' })
    }
    announceNft(previous, nft)
  }

  function onOrderUpdated(event: OrderUpdatedEvent) {
    if (event.audience && event.audience !== session.userId) return
    if (!accept(event.eventId)) return
    const order = event.data
    const key = `order:${order.id}`
    const cached = qc.getQueryData<OrderResponse>(orderKeys.detail(order.id))?.order
    const known = Math.max(versions.get(key) ?? 0, cached?.version ?? 0)
    if (event.version <= known) return
    versions.set(key, event.version)

    qc.setQueryData<OrderResponse>(orderKeys.detail(order.id), { order })
    if (order.status === 'confirmed') {
      qc.invalidateQueries({ queryKey: cartKeys.all })
      qc.invalidateQueries({ queryKey: nftKeys.all })
      notify(`Pedido ${order.id} confirmado.`)
    } else if (order.status === 'rejected') {
      notify(`O pagamento do pedido ${order.id} foi recusado.`)
    }
  }

  function reconcile() {
    qc.invalidateQueries({ queryKey: nftKeys.all, refetchType: 'active' })
    qc.invalidateQueries({ queryKey: cartKeys.all, refetchType: 'active' })
    qc.invalidateQueries({ queryKey: cartKeys.quotes, refetchType: 'active' })
    qc.invalidateQueries({ queryKey: orderKeys.all, refetchType: 'active' })
  }

  function stop() {
    epoch += 1
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
      socket = null
    }
    seenEvents.clear()
    versions.clear()
    connectedBefore = false
    setRealtimeStatus('idle')
  }

  async function start(next: RealtimeSession) {
    stop()
    session = next
    const current = epoch
    setRealtimeStatus('connecting')
    const factory = io ?? (await loadIo())
    if (current !== epoch) return
    const active =
      <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        if (current === epoch) fn(...args)
      }

    const origin = url ?? (typeof location !== 'undefined' ? location.origin : undefined)
    const connection = factory(origin as string, {
      path: REALTIME_PATH,
      transports: ['websocket'],
      auth: (cb) => cb(session.token ? { token: session.token } : {}),
      reconnection: true,
      reconnectionDelay: 300,
      reconnectionDelayMax: 2000,
    })
    socket = connection

    connection.on(
      'connect',
      active(() => {
        setRealtimeStatus('connected')
        if (connectedBefore) reconcile()
        connectedBefore = true
      }),
    )
    connection.on(
      'disconnect',
      active((reason: string) => {
        setRealtimeStatus('disconnected')
        if (reason === 'io server disconnect')
          setTimeout(
            active(() => connection.connect()),
            1000,
          )
      }),
    )
    connection.on(
      'connect_error',
      active((error: Error) => {
        setRealtimeStatus('disconnected')
        if (error.message === 'unauthorized') emitSessionExpired()
      }),
    )
    connection.on('nft.updated', active(onNftUpdated))
    connection.on('order.updated', active(onOrderUpdated))
  }

  return { start, stop }
}
