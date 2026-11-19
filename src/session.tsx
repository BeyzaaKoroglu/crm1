import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@wyndbase/sdk/react'
import { useRead } from './data'
import { label, money, type Deal, type PipelineRow, type Task } from './model'
import { errorText, read, session, write, wyndbase } from './wyndbase'
import { Banner, Button, Card, Empty, Page, Pill, Table, toneFor } from './ui'

function localTarget(value: string | null | undefined) {
  if (!value) return '/'
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    if (url.origin !== window.location.origin) return '/'
    return localTarget(url.searchParams.get('redirect'))
  } catch {
    return '/'
  }
}

const returnLeg = session.handleCallback()

export function Login() {
  const signedIn = useAuthStore((state) => state.isAuthenticated)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(true)

  useEffect(() => {
    let live = true
    void returnLeg.then((callback) => {
      if (!live) return
      if (callback.status === 'granted') {
        window.location.assign(localTarget(callback.redirect ?? callback.returnUrl))
        return
      }
      if (callback.status === 'error') setError(callback.errorDescription || callback.error)
      if (callback.status === 'failed') setError('Giriş tamamlanamadı. Yeniden deneyin.')
      setPending(false)
    }).catch((cause: unknown) => {
      if (!live) return
      setError(errorText(cause))
      setPending(false)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    window.location.assign(localTarget(new URLSearchParams(window.location.search).get('redirect')))
  }, [signedIn])

  async function enter() {
    setPending(true)
    setError(null)
    try {
      const result = await session.signIn()
      if (result.status === 'granted' || result.status === 'authenticated') {
        window.location.assign(localTarget(result.returnUrl ?? new URLSearchParams(window.location.search).get('redirect')))
        return
      }
      if (result.status === 'error') setError(result.errorDescription || 'Giriş tamamlanamadı. Yeniden deneyin.')
      else if (result.status !== 'redirecting') setError('Giriş tamamlanamadı. Yeniden deneyin.')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-copper">Wyndbase</p>
        <h1 className="mt-3 font-serif text-5xl text-ink">CRM</h1>
        <p className="mt-2 text-sm leading-6 text-stone-500">
          Hesaplar, kontaklar ve satış hattı. Giriş, bu tabanın Wyndbase hesabıyla yapılır.
        </p>
        {error ? <div className="mt-4"><Banner>{error}</Banner></div> : null}
        <div className="mt-6">
          <Button onClick={() => void enter()} disabled={pending}>
            {pending ? 'Yönlendiriliyor…' : 'Giriş yap'}
          </Button>
        </div>
      </div>
    </main>
  )
}

export function useRoles() {
  const roles = useRead<{ roleName: string }>('crm.myRoles')
  const names = new Set((roles.data ?? []).map((row) => row.roleName))
  const has = (...wanted: string[]) => wanted.some((role) => names.has(role))
  return {
    ready: roles.isSuccess,
    names: [...names],
    has,
    manage: has('yonetici', 'satis_muduru'),
    sell: has('yonetici', 'satis_muduru', 'satis'),
    govern: has('yonetici'),
  }
}

export function Dashboard({ go }: { go: (path: string) => void }) {
  const pipeline = useRead<PipelineRow>('crm.pipeline')
  const deals = useRead<Deal>('crm.listDeals')
  const tasks = useRead<Task>('crm.listTasks')
  const open = (deals.data ?? []).filter((row) => row.stage !== 'won' && row.stage !== 'lost')
  const waiting = (tasks.data ?? []).filter((row) => row.status === 'open')
  const order = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']
  const rows = [...(pipeline.data ?? [])].sort((a, b) => order.indexOf(a.stage) - order.indexOf(b.stage))

  return (
    <Page title="Satış hattı" lede="Açık fırsatlar, aşama toplamları ve bitmemiş görevler.">
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <Card key={row.stage} className="px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-stone-500">{label(row.stage)}</p>
            <p className="mt-1 font-serif text-3xl">{row.n}</p>
            <p className="text-sm text-stone-500">{money(row.total)}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="px-4 pt-4 font-medium">Açık fırsatlar</h2>
          {open.length === 0 ? <Empty>Açık fırsat yok.</Empty> : (
            <Table
              columns={['Fırsat', 'Hesap', 'Aşama']}
              rows={open.map((row) => [
                <button key={row._id} className="font-medium text-copper" onClick={() => go(`/firsatlar/${row._id}`)}>{row.title}</button>,
                row.account ?? '—',
                <Pill tone={toneFor(row.stage)}>{label(row.stage)}</Pill>,
              ])}
            />
          )}
        </Card>
        <Card>
          <h2 className="px-4 pt-4 font-medium">Açık görevler</h2>
          {waiting.length === 0 ? <Empty>Açık görev yok.</Empty> : (
            <Table
              columns={['Görev', 'Termin', 'Atanan']}
              rows={waiting.map((row) => [row.title, row.dueOn ?? '—', row.assignee ?? '—'])}
            />
          )}
        </Card>
      </div>
    </Page>
  )
}

export async function notifyOwner(ownerId: string | null, subject: string, body: string) {
  if (!ownerId) return 0
  const emails = await read<{ email: string; primary: boolean | null; userId: string | null }>('crm.listEmails')
  const target = emails.find((row) => row.primary && row.userId === ownerId)
  if (!target) return 0
  await write('crm.sendNotice', { to: target.email, subject, body })
  return 1
}

export function useMe() {
  return useQuery(wyndbase.account.getMe())
}
