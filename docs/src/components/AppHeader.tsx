import { Link, useRouter } from '@tanstack/react-router'
import { useSession, useLogout } from '@/features/auth/session'
import { useCart } from '@/features/cart/queries'
import { DEFAULT_SEARCH } from '@/features/catalog/search'
import { Button } from '@/components/ui/button'

export function AppHeader() {
  const router = useRouter()
  const session = useSession()
  const logout = useLogout()
  const { data } = useCart()
  const count = data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const user = session.data?.user

  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3">
      <Link to="/" search={DEFAULT_SEARCH} className="font-bold">
        NFT Marketplace
      </Link>
      <nav aria-label="Principal" className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          to="/"
          search={DEFAULT_SEARCH}
          activeProps={{ 'aria-current': 'page' }}
          className="hover:underline"
        >
          Catálogo
        </Link>
        <Link
          to="/cart"
          activeProps={{ 'aria-current': 'page' }}
          aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
          className="hover:underline"
        >
          Carrinho ({count})
        </Link>
        {user ? (
          <>
            <Link to="/profile" activeProps={{ 'aria-current': 'page' }} className="hover:underline">
              {user.name}
            </Link>
            <Link to="/wallets" activeProps={{ 'aria-current': 'page' }} className="hover:underline">
              Carteiras
            </Link>
            <Button
              variant="link"
              size="inline"
              type="button"

              disabled={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, {
                  onSettled: () => router.navigate({ to: '/', search: DEFAULT_SEARCH }),
                })
              }
            >
              Sair
            </Button>
          </>
        ) : (
          <>
            <Link to="/login" activeProps={{ 'aria-current': 'page' }} className="hover:underline">
              Entrar
            </Link>
            <Link to="/register" activeProps={{ 'aria-current': 'page' }} className="hover:underline">
              Criar conta
            </Link>
          </>
        )}
      </nav>
    </header>
  )
}
