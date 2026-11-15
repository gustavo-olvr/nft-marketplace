import { createRootRoute, createRoute, createRouter, Link, Outlet, redirect } from '@tanstack/react-router'
import { AppHeader } from '@/components/AppHeader'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { safeRedirect } from '@/features/auth/redirect'
import { CartPage } from '@/features/cart/CartPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { NftDetailPage } from '@/features/catalog/NftDetailPage'
import { DEFAULT_SEARCH, parseCatalogSearch } from '@/features/catalog/search'
import { CheckoutPage } from '@/features/checkout/CheckoutPage'
import { OrderPage } from '@/features/checkout/OrderPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { WalletsPage } from '@/features/wallets/WalletsPage'
import { RealtimeBridge } from '@/realtime/RealtimeBridge'
import { RealtimeFeedback } from '@/realtime/RealtimeFeedback'
import { getToken } from '@/lib/session-storage'

interface AuthSearch {
  redirect?: string
  expired?: boolean
}

const parseAuthSearch = (raw: Record<string, unknown>): AuthSearch => ({
  redirect: safeRedirect(raw.redirect),
  expired: raw.expired === true || raw.expired === 'true' ? true : undefined,
})

const requireAuth = ({ location }: { location: { href: string } }) => {
  if (!getToken()) throw redirect({ to: '/login', search: { redirect: location.href } })
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <RealtimeBridge />
      <AppHeader />
      <Outlet />
      <RealtimeFeedback />
    </>
  ),
})

const catalogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseCatalogSearch,
  component: CatalogPage,
})

const detailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$nftId',
  component: NftDetailPage,
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: parseAuthSearch,
  component: LoginPage,
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: parseAuthSearch,
  component: RegisterPage,
})

const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  beforeLoad: requireAuth,
  component: CheckoutPage,
})

const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  beforeLoad: requireAuth,
  component: OrderPage,
})

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  beforeLoad: requireAuth,
  component: ProfilePage,
})

const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  beforeLoad: requireAuth,
  component: WalletsPage,
})

const routeTree = rootRoute.addChildren([
  catalogRoute,
  detailRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  checkoutRoute,
  orderRoute,
  profileRoute,
  walletsRoute,
])

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <main className="p-6">
      <h1 className="text-xl font-bold">Página não encontrada</h1>
      <Link to="/" search={DEFAULT_SEARCH} className="underline">
        Voltar ao catálogo
      </Link>
    </main>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
