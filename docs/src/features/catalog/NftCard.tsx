import { Link } from '@tanstack/react-router'
import type { Nft } from '@/contracts'
import { formatEth } from '@/lib/money'
import { Skeleton } from '@/components/ui/skeleton'

export const GRID_CLASS = 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'

export function NftCard({ nft }: { nft: Nft }) {
  const soldOut = nft.available === 0
  return (
    <article className="relative overflow-hidden rounded-lg border">
      <img
        src={nft.imageUrl}
        alt={`Arte do NFT ${nft.name}, da coleção ${nft.collection.name}`}
        width={600}
        height={600}
        loading="lazy"
        className="aspect-square w-full object-cover"
      />
      <div className="p-3">
        <h2 className="h-6 truncate font-semibold">
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            className="after:absolute after:inset-0 hover:underline"
          >
            {nft.name}
          </Link>
        </h2>
        <p className="h-5 truncate text-sm text-muted-foreground">{nft.collection.name}</p>
        <p className="h-6 font-medium">
          {formatEth(nft.price)}
          {soldOut && <span className="ml-2 text-sm font-normal">· Esgotado</span>}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-0 p-3">
        <div className="h-6 py-1">
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="h-5 py-0.5">
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="h-6 py-1">
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </div>
  )
}

export function NftGridSkeleton({ count }: { count: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando catálogo…</span>
      <div className={GRID_CLASS}>
        {Array.from({ length: count }, (_, i) => (
          <NftCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
