import { getRouteApi, Link } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { AddToCart } from '@/features/cart/AddToCart'
import { FavoriteButton } from '@/features/favorites/FavoriteButton'
import { useNft } from './queries'
import { DEFAULT_SEARCH } from './search'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const route = getRouteApi('/nfts/$nftId')

export function NftDetailPage() {
  const { nftId } = route.useParams()
  const { data: nft, isPending, isError, error, refetch } = useNft(nftId)
  usePageTitle(nft?.name ?? 'NFT')

  if (isPending) {
    return (
      <div className="p-6" role="status">
        <span className="sr-only">Carregando NFT…</span>
        <Skeleton className="aspect-square w-full max-w-md" />
        <Skeleton className="mt-4 h-8 w-64" />
      </div>
    )
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-bold">NFT não encontrado</h1>
          <p>O NFT "{nftId}" não existe ou foi removido.</p>
          <Link to="/" search={DEFAULT_SEARCH} className="underline">
            Voltar ao catálogo
          </Link>
        </div>
      )
    }
    return (
      <div className="p-6" role="alert">
        <p>Não foi possível carregar o NFT: {error.message}</p>
        <Button variant="link" size="inline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <main className="p-6">
      <Link to="/" search={DEFAULT_SEARCH} className="underline">
        ← Catálogo
      </Link>
      <img
        src={nft.imageUrl}
        alt={`Arte do NFT ${nft.name}`}
        width={600}
        height={600}
        className="mt-4 aspect-square w-full max-w-md object-cover"
      />
      <h1 className="mt-4 text-2xl font-bold">{nft.name}</h1>
      <p className="text-muted-foreground">
        {nft.collection.name} · {nft.creator}
      </p>
      <p className="mt-2">{nft.description}</p>

      <div className="mt-4">
        <FavoriteButton nftId={nft.id} name={nft.name} />
      </div>

      <AddToCart nft={nft} />
    </main>
  )
}
