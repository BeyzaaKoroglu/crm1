import { useEffect, useState } from 'react'
import { useAuthStore } from '@wyndbase/sdk/react'
import { Accounts, Contacts, Inbox, People, Tasks } from './records'
import { Deals } from './deals'
import { Dashboard, Login, useMe, useRoles } from './session'
import { label } from './model'
import { loginPath, session, wyndbase } from './wyndbase'

type Route =
  | { name: 'home' }
  | { name: 'accounts' }
  | { name: 'contacts' }
  | { name: 'deals'; id?: string }
  | { name: 'tasks' }
  | { name: 'inbox' } 
  | { name: 'people' }

function parse(path: string): Route {
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'hesaplar') return { name: 'accounts' }
  if (parts[0] === 'kontaklar') return { name: 'contacts' }
  if (parts[0] === 'firsatlar') return { name: 'deals', id: parts[1] }
  if (parts[0] === 'gorevler') return { name: 'tasks' }
  if (parts[0] === 'gelen') return { name: 'inbox' }
  if (parts[0] === 'ekip') return { name: 'people' }
  return { name: 'home' }
}

function useRoute() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  return {
    path,
    route: parse(path),
    go(next: string) {
      window.history.pushState(null, '', next)
      setPath(next)
    },
  }
}

export function App() {
  const { path } = useRoute()
  if (path.startsWith(loginPath)) return <Login />
  return <Desk />
}

function Desk() {
  const signedIn = useAuthStore((state) => state.isAuthenticated)
  const { route, go } = useRoute()

  useEffect(() => {
    if (signedIn !== false || session.isReturning()) return
    const next = window.location.pathname + window.location.search
    window.location.assign(`${loginPath}?redirect=${encodeURIComponent(next)}`)
  }, [signedIn])

  if (signedIn !== true) {
    return <main className="grid min-h-screen place-items-center text-sm text-stone-500">Oturum açılıyor…</main>
  }
  return <Shell route={route} go={go} />
}

const nav = [
  ['/', 'Özet'],
  ['/hesaplar', 'Hesaplar'],
  ['/kontaklar', 'Kontaklar'],
  ['/firsatlar', 'Fırsatlar'],
  ['/gorevler', 'Görevler'],
  ['/gelen', 'Gelen'],
] as const

function Shell({ route, go }: { route: Route; go: (path: string) => void }) {
  const roles = useRoles()
  const me = useMe()
  const name = me.data?.name || me.data?.username || 'Hesap'

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="bg-stone-950 text-stone-100 md:min-h-screen">
        <div className="px-5 py-6">
          <p className="font-serif text-3xl">CRM</p>
          <p className="text-xs tracking-wide text-stone-400">Satış masası</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-4 md:block md:space-y-1">
          {nav.map(([href, text]) => {
            const active = href === '/' ? route.name === 'home' : window.location.pathname.startsWith(href)
            return (
              <button
                key={href}
                onClick={() => go(href)}
                className={`block whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm ${active ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}
              >
                {text}
              </button>
            )
          })}
          {roles.govern ? (
            <button
              onClick={() => go('/ekip')}
              className={`block rounded-xl px-3 py-2 text-left text-sm ${route.name === 'people' ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5'}`}
            >
              Ekip
            </button>
          ) : null}
        </nav>
      </aside>
      <div>
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <p className="text-sm text-stone-500">{name}</p>
          <div className="flex items-center gap-3">
            <p className="text-xs text-stone-500">{roles.names.map((role) => label(role)).join(' · ') || 'Rol yok'}</p>
            <button className="text-sm text-copper" onClick={() => wyndbase.auth.logout({ scope: 'app' })}>Çıkış</button>
          </div>
        </header>
        <main className="px-6 py-6">
          {roles.ready && roles.names.length === 0 ? (
            <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Bu hesapta satış rolü yok. Yönetici bir rol atayana kadar kayıtlar salt okunur kalır; yazma sunucuda da reddedilir.
            </p>
          ) : null}
          {route.name === 'home' ? <Dashboard go={go} /> : null}
          {route.name === 'accounts' ? <Accounts /> : null}
          {route.name === 'contacts' ? <Contacts /> : null}
          {route.name === 'deals' ? <Deals id={route.id} go={go} /> : null}
          {route.name === 'tasks' ? <Tasks /> : null}
          {route.name === 'inbox' ? <Inbox /> : null}
          {route.name === 'people' && roles.govern ? <People /> : null}
        </main>
      </div>
    </div>
  )
}
