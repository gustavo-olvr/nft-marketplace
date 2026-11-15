import type { ReactNode } from 'react'
import { getRouteApi } from '@tanstack/react-router'
import { CatalogFilters } from './CatalogFilters'
import { GRID_CLASS, NftCard, NftGridSkeleton } from './NftCard'
import { useNftList } from './queries'
import { DEFAULT_SEARCH, type CatalogSearch } from './search'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/lib/use-media-query'
import { usePageTitle } from '@/lib/use-page-title'

const route = getRouteApi('/')
const PAGE_SIZE = 12

function activeFilters(search: CatalogSearch) {
  return (
    (search.q ? 1 : 0) +
    (search.category?.length ?? 0) +
    (search.inStock ? 1 : 0) +
    (search.collection ? 1 : 0) +
    (search.minPrice ? 1 : 0) +
    (search.maxPrice ? 1 : 0)
  )
}

export function CatalogPage() {
  usePageTitle('Catálogo')
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const { data, isPending, isError, error, isFetching, isPlaceholderData, refetch } = useNftList({
    ...search,
    pageSize: PAGE_SIZE,
  })

  const update = (patch: Partial<CatalogSearch>, replace = false) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }), replace })
  const clear = () => navigate({ search: DEFAULT_SEARCH })

  let results: ReactNode
  if (isPending) {
    results = <NftGridSkeleton count={PAGE_SIZE} />
  } else if (isError) {
    results = (
      <div role="alert">
        <p>Não foi possível carregar o catálogo: {error.message}</p>
        <Button variant="link" size="inline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </div>
    )
  } else if (data.items.length === 0) {
    results = <p>Nenhum NFT encontrado.</p>
  } else {
    results = (
      <>
        <p aria-live="polite" className="mb-4">
          {data.total} resultados {isFetching && '(atualizando…)'}
        </p>
        <div className={`${GRID_CLASS} ${isPlaceholderData ? 'opacity-60' : ''}`} aria-busy={isFetching}>
          {data.items.map((nft) => (
            <NftCard key={nft.id} nft={nft} />
          ))}
        </div>
        <nav aria-label="Paginação" className="mt-4 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => update({ page: data.page - 1 })}
          >
            Anterior
          </Button>
          <span>
            Página {data.page} de {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => update({ page: data.page + 1 })}
          >
            Próxima
          </Button>
        </nav>
      </>
    )
  }

  const filters = <CatalogFilters search={search} onChange={update} onClear={clear} />
  const count = activeFilters(search)

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Catálogo de NFTs</h1>
      {isDesktop ? (
        filters
      ) : (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="mb-4">
              Filtros{count > 0 ? ` (${count})` : ''}
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
              <SheetDescription>
                Refine o catálogo por busca, categoria, disponibilidade e ordenação.
              </SheetDescription>
            </SheetHeader>
            {filters}
            <SheetClose asChild>
              <Button>Ver resultados</Button>
            </SheetClose>
          </SheetContent>
        </Sheet>
      )}
      {results}
    </main>
  )
}
