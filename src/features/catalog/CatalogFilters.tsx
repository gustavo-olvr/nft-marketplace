import { useEffect, useRef, useState } from 'react'
import type { Category, NftSort } from '@/contracts'
import { CATEGORIES, SORTS, type CatalogSearch } from './search'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORY_LABEL: Record<Category, string> = {
  art: 'Arte',
  music: 'Música',
  photography: 'Fotografia',
  gaming: 'Games',
  collectibles: 'Colecionáveis',
}
const SORT_LABEL: Record<NftSort, string> = {
  newest: 'Mais recentes',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  name: 'Nome (A–Z)',
}

interface Props {
  search: CatalogSearch
  onChange: (patch: Partial<CatalogSearch>, replace?: boolean) => void
  onClear: () => void
}

export function CatalogFilters({ search, onChange, onClear }: Props) {
  const [draft, setDraft] = useState<string>()
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  })

  if (draft !== undefined && draft.trim() === (search.q ?? '')) setDraft(undefined)
  const text = draft ?? search.q ?? ''

  useEffect(() => {
    if (draft === undefined || draft.trim() === (search.q ?? '')) return
    const id = setTimeout(() => onChangeRef.current({ q: draft.trim() || undefined }, true), 300)
    return () => clearTimeout(id)
  }, [draft, search.q])

  const toggleCategory = (c: Category) => {
    const cur = search.category ?? []
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
    onChange({ category: next.length ? next : undefined })
  }

  return (
    <form role="search" className="mb-6 space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div>
        <Label htmlFor="q">Buscar</Label>
        <Input
          id="q"
          type="search"
          value={text}
          onChange={(e) => setDraft(e.target.value)}
          className="mt-1.5 max-w-sm"
          placeholder="Nome, criador ou coleção"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Categorias</legend>
        {CATEGORIES.map((c) => (
          <label key={c} className="mr-4 inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={search.category?.includes(c) ?? false}
              onChange={() => toggleCategory(c)}
            />
            {CATEGORY_LABEL[c]}
          </label>
        ))}
      </fieldset>

      <label className="inline-flex items-center gap-1">
        <input
          type="checkbox"
          checked={search.inStock ?? false}
          onChange={(e) => onChange({ inStock: e.target.checked || undefined })}
        />
        Somente disponíveis
      </label>

      <div>
        <label htmlFor="sort" className="mr-2 text-sm font-medium">
          Ordenar por
        </label>
        <select
          id="sort"
          value={search.sort}
          onChange={(e) => onChange({ sort: e.target.value as NftSort })}
          className="border px-2 py-1"
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <Button variant="link" size="inline" type="button" onClick={onClear}>
        Limpar filtros
      </Button>
    </form>
  )
}
