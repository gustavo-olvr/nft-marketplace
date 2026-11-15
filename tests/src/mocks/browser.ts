import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { events, resetDb, settleDue } from './db'
import { realtimeControl } from './socket'
import { getScenario, SCENARIOS, setScenario, type ScenarioName } from './scenarios'

declare global {
  interface Window {
    __mock?: MockControl
  }
}
interface MockControl {
  scenario(): string
  scenarios: Record<string, string>
  setScenario(name: ScenarioName, opts?: { reset?: boolean }): void
  reset(): void
  expireSession(): void
  events: typeof events
  realtime: typeof realtimeControl
}

export async function startMocking() {
  const worker = setupWorker(...handlers)
  await worker.start({ serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` } })
  window.__mock = {
    scenario: () => getScenario().name,
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([k, v]) => [k, v.description])),
    setScenario: (name, opts) => {
      setScenario(name)
      if (opts?.reset) resetDb()
    },
    reset: () => {
      resetDb()
    },
    expireSession: () => {
      import('./db').then(({ db, commit }) => {
        const s = db()
        s.expiredTokens.push(...Object.keys(s.sessions))
        s.sessions = {}
        commit()
        Object.values(s.users).forEach((u) => events.emit({ type: 'session.revoked', userId: u.id }))
      })
    },
    events,
    realtime: realtimeControl,
  }
  setInterval(() => settleDue(), 500)
}
