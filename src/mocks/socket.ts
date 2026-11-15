import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft, RealtimeEvent } from '@/contracts'
import { REALTIME_PATH } from '@/config'
import { bumpPrice, db, events, mutateNft } from './db'

const realtime = ws.link(`*${REALTIME_PATH}/`)

const PING_INTERVAL_MS = 20_000
const CLOSE_DELAY_MS = 50

interface MockClient {
  userId: string | null
  authed: boolean
  emit: (name: string, payload: unknown) => void
  sendRaw: (data: string) => void
  close: () => void
}

interface SentEvent {
  name: string
  payload: RealtimeEvent<unknown>
}

const clients = new Set<MockClient>()
let blocked = false
let counter = 0
let last: SentEvent | null = null

function makeEvent<T>(
  resource: 'nft' | 'order',
  resourceId: string,
  version: number,
  data: T,
  audience?: string,
): RealtimeEvent<T> {
  counter += 1
  return {
    eventId: `evt_${Date.now().toString(36)}_${counter}`,
    resource,
    resourceId,
    version,
    occurredAt: new Date().toISOString(),
    audience,
    data,
  }
}

function deliver(name: string, payload: RealtimeEvent<unknown>, filter: (client: MockClient) => boolean) {
  last = { name, payload }
  clients.forEach((client) => {
    if (client.authed && filter(client)) client.emit(name, payload)
  })
}

function parseConnect(data: unknown): { token?: string } | null {
  if (typeof data !== 'string' || !data.startsWith('40')) return null
  const rest = data.slice(2)
  if (!rest) return {}
  try {
    return JSON.parse(rest) as { token?: string }
  } catch {
    return null
  }
}

events.on((event) => {
  if (event.type === 'nft.updated') {
    deliver('nft.updated', makeEvent('nft', event.nft.id, event.nft.version, event.nft), () => true)
  } else if (event.type === 'order.updated') {
    const payload = makeEvent('order', event.order.id, event.order.version, event.order, event.userId)
    deliver('order.updated', payload, (client) => client.userId === event.userId)
  } else if (event.type === 'session.revoked') {
    clients.forEach((client) => {
      if (client.userId !== event.userId) return
      client.sendRaw('41')
      setTimeout(() => client.close(), CLOSE_DELAY_MS)
    })
  }
})

export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    if (blocked) {
      connection.server.connect()
      return
    }

    const sio = toSocketIo(connection)
    const client: MockClient = {
      userId: null,
      authed: false,
      emit: (name, payload) => sio.client.emit(name, payload),
      sendRaw: (data) => connection.client.send(data),
      close: () => connection.client.close(),
    }
    clients.add(client)

    const ping = setInterval(() => connection.client.send('2'), PING_INTERVAL_MS)

    connection.client.addEventListener('message', (event) => {
      const connect = parseConnect(event.data)
      if (!connect) return
      if (connect.token) {
        const session = db().sessions[connect.token]
        if (!session || Date.now() > session.expiresAt) {
          client.sendRaw('44' + JSON.stringify({ message: 'unauthorized' }))
          setTimeout(() => client.close(), CLOSE_DELAY_MS)
          return
        }
        client.userId = session.userId
      }
      client.authed = true
    })

    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      clients.delete(client)
    })
  }),
]

export const realtimeControl = {
  connections: () => clients.size,
  dropConnections() {
    clients.forEach((client) => client.close())
  },
  block(value: boolean) {
    blocked = value
    if (value) realtimeControl.dropConnections()
  },
  changePrice(nftId: string, editionId: string, percent: number) {
    bumpPrice(nftId, editionId, percent)
  },
  setAvailability(nftId: string, editionId: string, available: number) {
    mutateNft(nftId, editionId, { available })
  },
  replayLast() {
    if (!last) return
    const { name, payload } = last
    clients.forEach((client) => {
      if (client.authed) client.emit(name, payload)
    })
  },
  sendStaleNft(nftId: string) {
    const current = db().nfts.find((n) => n.id === nftId)
    if (!current) return
    const stale: Nft = structuredClone(current)
    stale.version = Math.max(1, current.version - 1)
    stale.editions.forEach((edition) => {
      edition.price = '999'
    })
    const payload = makeEvent('nft', stale.id, stale.version, stale)
    clients.forEach((client) => {
      if (client.authed) client.emit('nft.updated', payload)
    })
  },
}
