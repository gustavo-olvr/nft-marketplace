import { useRouter } from '@tanstack/react-router'
import { getToken } from '@/lib/session-storage'
import { useFavorites, useToggleFavorite } from './queries'
import { Button } from '@/components/ui/button'

export function FavoriteButton({ nftId, name }: { nftId: string; name: string }) {
  const router = useRouter()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const isFavorite = favorites.data?.nftIds.includes(nftId) ?? false

  const onClick = () => {
    if (getToken() === null) {
      router.navigate({ to: '/login', search: { redirect: router.state.location.href } })
      return
    }
    toggle.mutate({ nftId, favorite: !isFavorite })
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        type="button"
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remover ${name} dos favoritos` : `Adicionar ${name} aos favoritos`}
        onClick={onClick}
      >
        <span aria-hidden="true">{isFavorite ? '♥' : '♡'}</span> {isFavorite ? 'Favoritado' : 'Favoritar'}
      </Button>
      <div aria-live="polite" className="min-h-5 text-sm">
        {toggle.isError && <p role="alert">Não foi possível atualizar seus favoritos. Tente novamente.</p>}
      </div>
    </div>
  )
}
