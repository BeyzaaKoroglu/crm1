import { useState } from 'react'
import { useRefresh, useRead } from './data'
import {
  activityKinds,
  blank,
  currencies,
  label,
  money,
  moves,
  today,
  type Account,
  type Activity,
  type Contact,
  type Deal,
  type Person,
  type Task,
} from './model'
import { notifyOwner, useMe, useRoles } from './session'
import { errorText, write } from './wyndbase'
import { Banner, Button, Card, Empty, Field, Page, Pill, Select, Table, TextInput, Area, toneFor } from './ui'

export function Deals({ id, go }: { id?: string; go: (path: string) => void }) {
  if (id) return <DealView id={id} go={go} />
  return <DealList go={go} />
}

function DealList({ go }: { go: (path: string) => void }) {
  const rows = useRead<Deal>('crm.listDeals')
  const accounts = useRead<Account>('crm.listAccounts')
  const contacts = useRead<Contact>('crm.listContacts')
  const people = useRead<Person>('crm.listPeople')
  const me = useMe()
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setPending(true)
    setError(null)
    try {
      const created = await write<{ _id: string }>('crm.createDeal', {
        title: String(data.get('title')),
        amount: Number(data.get('amount') || 0),
        currency: String(data.get('currency') || 'TRY'),
        closeDate: blank(data.get('closeDate')),
        notes: blank(data.get('notes')),
        accountId: blank(data.get('accountId')),
        contactId: blank(data.get('contactId')),
        ownerId: roles.manage ? String(data.get('ownerId') || me.data?._id) : me.data?._id,
      })
      const dealId = created[0]?._id
      event.currentTarget.reset()
      await refresh('crm.listDeals', 'crm.pipeline')
      if (dealId) go(`/firsatlar/${dealId}`)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setPending(false)
    }
  }

  return (
    <Page title="Fırsatlar" lede="Yeni fırsat aday aşamasında açılır. Kazanmak ve yeniden açmak satış müdürü ile yöneticiye aittir.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <Card>
        {(rows.data ?? []).length === 0 ? <Empty>Fırsat yok.</Empty> : (
          <Table
            columns={['Başlık', 'Hesap', 'Tutar', 'Aşama', 'Kapanış', 'Sahip']}
            rows={(rows.data ?? []).map((row) => [
              <button className="font-medium text-copper" onClick={() => go(`/firsatlar/${row._id}`)}>{row.title}</button>,
              row.account ?? '—',
              money(row.amount, row.currency),
              <Pill tone={toneFor(row.stage)}>{label(row.stage)}</Pill>,
              row.closeDate ?? '—',
              row.owner ?? '—',
            ])}
          />
        )}
      </Card>
      {roles.sell ? (
        <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <h2 className="font-serif text-2xl md:col-span-2">Yeni fırsat</h2>
          <Field label="Başlık"><TextInput name="title" required /></Field>
          <Field label="Tutar"><TextInput name="amount" type="number" min="0" step="0.01" defaultValue="0" required /></Field>
          <Field label="Para birimi">
            <Select name="currency" defaultValue="TRY">
              {currencies.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </Select>
          </Field>
          <Field label="Kapanış"><TextInput name="closeDate" type="date" /></Field>
          <Field label="Hesap">
            <Select name="accountId" defaultValue="">
              <option value="">—</option>
              {(accounts.data ?? []).map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </Select>
          </Field>
          <Field label="Kontak">
            <Select name="contactId" defaultValue="">
              <option value="">—</option>
              {(contacts.data ?? []).map((contact) => <option key={contact._id} value={contact._id}>{contact.name}</option>)}
            </Select>
          </Field>
          {roles.manage ? (
            <Field label="Sahip">
              <Select name="ownerId" defaultValue={me.data?._id}>
                {(people.data ?? []).map((person) => (
                  <option key={person._id} value={person._id}>{person.name || person.username}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Not"><Area name="notes" /></Field>
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? 'Açılıyor…' : 'Fırsatı aç'}</Button>
          </div>
        </form>
      ) : null}
    </Page>
  )
}

function DealView({ id, go }: { id: string; go: (path: string) => void }) {
  const deals = useRead<Deal>('crm.listDeals')
  const activities = useRead<Activity>('crm.listActivities')
  const tasks = useRead<Task>('crm.listTasks')
  const deal = (deals.data ?? []).find((row) => row._id === id)
  const roles = useRoles()
  const me = useMe()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const mine = deal?.ownerId === me.data?._id
  const canWrite = roles.manage || (roles.sell && mine && deal?.stage !== 'won')

  async function move(stage: string) {
    if (!deal) return
    setError(null)
    if (stage === 'won' && Number(deal.amount) <= 0) {
      setError('Kazanılan fırsatın tutarı sıfırdan büyük olmalı.')
      return
    }
    try {
      const moved = await write<{ _id: string; stage: string; title: string }>('crm.moveDeal', { id, stage })
      if (moved.length === 0) {
        setError('Bu aşama değişikliği yapılamaz.')
        return
      }
      if (stage === 'won' && roles.manage) {
        await notifyOwner(deal.ownerId, `Kazanıldı: ${deal.title}`, `${deal.title} kazanıldı. Tutar ${money(deal.amount, deal.currency)}.`)
      }
      await refresh('crm.listDeals', 'crm.pipeline')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    try {
      const saved = await write('crm.updateDeal', {
        id,
        title: String(data.get('title')),
        amount: Number(data.get('amount') || 0),
        currency: String(data.get('currency')),
        closeDate: blank(data.get('closeDate')),
        notes: blank(data.get('notes')),
      })
      if (saved.length === 0) setError('Bu fırsat bu durumda değiştirilemez.')
      await refresh('crm.listDeals', 'crm.pipeline')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  async function addActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    try {
      await write('crm.createActivity', {
        kind: String(data.get('kind') || 'note'),
        subject: String(data.get('subject')),
        body: blank(data.get('body')),
        occurredOn: String(data.get('occurredOn') || today()),
        accountId: deal?.accountId ?? null,
        contactId: deal?.contactId ?? null,
        dealId: id,
        ownerId: me.data?._id,
      })
      event.currentTarget.reset()
      await refresh('crm.listActivities')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  if (deals.isSuccess && !deal) {
    return (
      <Page title="Fırsat yok" lede="Bu kayıt silinmiş veya size kapalı olabilir.">
        <Button tone="ghost" onClick={() => go('/firsatlar')}>Listeye dön</Button>
      </Page>
    )
  }

  const notes = (activities.data ?? []).filter((row) => row.dealId === id)
  const work = (tasks.data ?? []).filter((row) => row.dealId === id)

  return (
    <Page title={deal?.title ?? 'Fırsat'} lede={deal ? `${deal.account ?? 'Hesapsız'} · ${deal.owner ?? 'Sahipsiz'}` : 'Yükleniyor…'}>
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      {deal ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Pill tone={toneFor(deal.stage)}>{label(deal.stage)}</Pill>
          <span className="font-serif text-2xl">{money(deal.amount, deal.currency)}</span>
          {moves(deal.stage, roles.manage).map((stage) => (
            <Button key={stage} tone="ghost" onClick={() => void move(stage)}>{label(stage)}</Button>
          ))}
          <Button tone="ghost" onClick={() => go('/firsatlar')}>Liste</Button>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 font-medium">Kayıt</h2>
          {deal && canWrite ? (
            <form onSubmit={(event) => void save(event)} className="grid gap-3">
              <Field label="Başlık"><TextInput name="title" defaultValue={deal.title} required /></Field>
              <Field label="Tutar"><TextInput name="amount" type="number" min="0" step="0.01" defaultValue={deal.amount} required /></Field>
              <Field label="Para birimi">
                <Select name="currency" defaultValue={deal.currency}>
                  {currencies.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
                </Select>
              </Field>
              <Field label="Kapanış"><TextInput name="closeDate" type="date" defaultValue={deal.closeDate ?? ''} /></Field>
              <Field label="Not"><Area name="notes" defaultValue={deal.notes ?? ''} /></Field>
              <Button type="submit">Kaydet</Button>
            </form>
          ) : deal ? (
            <dl className="grid gap-2 text-sm">
              <div><dt className="text-stone-500">Kontak</dt><dd>{deal.contact ?? '—'}</dd></div>
              <div><dt className="text-stone-500">Kapanış</dt><dd>{deal.closeDate ?? '—'}</dd></div>
              <div><dt className="text-stone-500">Not</dt><dd>{deal.notes ?? '—'}</dd></div>
            </dl>
          ) : null}
        </Card>
        <div className="grid gap-4">
          <Card>
            <h2 className="px-4 pt-4 font-medium">Etkinlikler</h2>
            {notes.length === 0 ? <Empty>Bu fırsatta etkinlik yok.</Empty> : (
              <Table
                columns={['Tarih', 'Tür', 'Konu']}
                rows={notes.map((row) => [row.occurredOn, label(row.kind), row.subject])}
              />
            )}
          </Card>
          <Card>
            <h2 className="px-4 pt-4 font-medium">Görevler</h2>
            {work.length === 0 ? <Empty>Bu fırsatta görev yok.</Empty> : (
              <Table
                columns={['Başlık', 'Termin', 'Durum']}
                rows={work.map((row) => [row.title, row.dueOn ?? '—', label(row.status)])}
              />
            )}
          </Card>
        </div>
      </div>
      {roles.sell ? (
        <form onSubmit={(event) => void addActivity(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <h2 className="font-serif text-2xl md:col-span-2">Etkinlik ekle</h2>
          <Field label="Konu"><TextInput name="subject" required /></Field>
          <Field label="Tür">
            <Select name="kind" defaultValue="note">
              {activityKinds.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </Select>
          </Field>
          <Field label="Tarih"><TextInput name="occurredOn" type="date" defaultValue={today()} required /></Field>
          <Field label="Ayrıntı"><Area name="body" /></Field>
          <div className="md:col-span-2"><Button type="submit">Etkinliği kaydet</Button></div>
        </form>
      ) : null}
    </Page>
  )
}
