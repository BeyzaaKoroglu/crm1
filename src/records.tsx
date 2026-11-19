import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRefresh, useRead } from './data'
import {
  accountStatuses,
  blank,
  industries,
  label,
  roleNames,
  today,
  type Account,
  type Contact,
  type Deal,
  type EmailRow,
  type Membership,
  type Person,
  type Task,
} from './model'
import { useMe, useRoles } from './session'
import { errorText, write, wyndbase } from './wyndbase'
import { Banner, Button, Card, Empty, Field, Page, Pill, Select, Table, TextInput, toneFor } from './ui'

export function Accounts() {
  const rows = useRead<Account>('crm.listAccounts')
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
      await write('crm.createAccount', {
        name: String(data.get('name')),
        industry: blank(data.get('industry')),
        website: blank(data.get('website')),
        phone: blank(data.get('phone')),
        city: blank(data.get('city')),
        status: String(data.get('status') || 'prospect'),
        ownerId: roles.manage ? String(data.get('ownerId')) : me.data?._id,
      })
      event.currentTarget.reset()
      await refresh('crm.listAccounts')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await write('crm.deleteAccount', { id })
      await refresh('crm.listAccounts', 'crm.listContacts', 'crm.listDeals')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  return (
    <Page title="Hesaplar" lede="Satışın yürüdüğü şirketler. Sahip, kaydı açan kişidir; satış yalnız kendi hesabını değiştirir.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <Card>
        {(rows.data ?? []).length === 0 ? <Empty>Hesap yok.</Empty> : (
          <Table
            columns={['Ad', 'Sektör', 'Şehir', 'Durum', 'Sahip', '']}
            rows={(rows.data ?? []).map((row) => [
              row.name,
              label(row.industry),
              row.city ?? '—',
              <Pill tone={toneFor(row.status)}>{label(row.status)}</Pill>,
              row.owner ?? '—',
              roles.sell ? <button className="text-rose-800" onClick={() => void remove(row._id)}>Sil</button> : '—',
            ])}
          />
        )}
      </Card>
      {roles.sell ? (
        <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <h2 className="font-serif text-2xl md:col-span-2">Yeni hesap</h2>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="Sektör">
            <Select name="industry" defaultValue="">
              <option value="">—</option>
              {industries.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
            </Select>
          </Field>
          <Field label="Şehir"><TextInput name="city" /></Field>
          <Field label="Telefon"><TextInput name="phone" /></Field>
          <Field label="Web"><TextInput name="website" /></Field>
          <Field label="Durum">
            <Select name="status" defaultValue="prospect">
              {accountStatuses.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
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
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Hesabı aç'}</Button>
          </div>
        </form>
      ) : null}
    </Page>
  )
}

export function Contacts() {
  const rows = useRead<Contact>('crm.listContacts')
  const accounts = useRead<Account>('crm.listAccounts')
  const me = useMe()
  const roles = useRoles()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const [accountId, setAccountId] = useState('')

  const shown = (rows.data ?? []).filter((row) => !accountId || row.accountId === accountId)

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    try {
      await write('crm.createContact', {
        name: String(data.get('name')),
        email: blank(data.get('email')),
        phone: blank(data.get('phone')),
        jobTitle: blank(data.get('jobTitle')),
        accountId: blank(data.get('accountId')),
        ownerId: roles.manage ? String(data.get('ownerId') || me.data?._id) : me.data?._id,
      })
      event.currentTarget.reset()
      await refresh('crm.listContacts')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  return (
    <Page title="Kontaklar" lede="Hesaba bağlı kişiler. Bunlar uygulama kullanıcısı değildir; ad ve e-posta burada durur.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <div className="mb-4 max-w-xs">
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Bütün hesaplar</option>
          {(accounts.data ?? []).map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
        </Select>
      </div>
      <Card>
        {shown.length === 0 ? <Empty>Kontak yok.</Empty> : (
          <Table
            columns={['Ad', 'Ünvan', 'Hesap', 'E-posta', 'Telefon']}
            rows={shown.map((row) => [row.name, row.jobTitle ?? '—', row.account ?? '—', row.email ?? '—', row.phone ?? '—'])}
          />
        )}
      </Card>
      {roles.sell ? (
        <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <h2 className="font-serif text-2xl md:col-span-2">Yeni kontak</h2>
          <Field label="Ad"><TextInput name="name" required /></Field>
          <Field label="Ünvan"><TextInput name="jobTitle" /></Field>
          <Field label="E-posta"><TextInput name="email" type="email" /></Field>
          <Field label="Telefon"><TextInput name="phone" /></Field>
          <Field label="Hesap">
            <Select name="accountId" defaultValue="">
              <option value="">—</option>
              {(accounts.data ?? []).map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2"><Button type="submit">Kontak ekle</Button></div>
        </form>
      ) : null}
    </Page>
  )
}

export function Tasks() {
  const roles = useRoles()
  const rows = useRead<Task>('crm.listTasks')
  const accounts = useRead<Account>('crm.listAccounts')
  const deals = useRead<Deal>('crm.listDeals')
  const people = useRead<Person>('crm.listPeople', undefined, roles.manage)
  const me = useMe()
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setError(null)
    try {
      await write('crm.createTask', {
        title: String(data.get('title')),
        dueOn: blank(data.get('dueOn')),
        status: 'open',
        notes: blank(data.get('notes')),
        accountId: blank(data.get('accountId')),
        dealId: blank(data.get('dealId')),
        assigneeId: roles.manage ? blank(data.get('assigneeId')) ?? me.data?._id : me.data?._id,
      })
      event.currentTarget.reset()
      await refresh('crm.listTasks')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  async function finish(row: Task) {
    setError(null)
    try {
      const result = await write<{ _id: string }>('crm.updateTask', { id: row._id, status: row.status === 'open' ? 'done' : 'open' })
      if (result.length === 0) setError('Bu görev size atanmadığı için değiştirilemez.')
      await refresh('crm.listTasks')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  return (
    <Page title="Görevler" lede="Atanan kişi görevi kapatır. Satış, başkasına atanmış görevi değiştiremez.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <Card>
        {(rows.data ?? []).length === 0 ? <Empty>Görev yok.</Empty> : (
          <Table
            columns={['Başlık', 'Termin', 'Durum', 'Fırsat', 'Atanan', '']}
            rows={(rows.data ?? []).map((row) => [
              row.title,
              row.dueOn ?? '—',
              <Pill tone={toneFor(row.status)}>{label(row.status)}</Pill>,
              row.deal ?? '—',
              row.assignee ?? '—',
              roles.sell && (roles.manage || row.assigneeId === me.data?._id)
                ? <button className="text-copper" onClick={() => void finish(row)}>{row.status === 'open' ? 'Bitir' : 'Yeniden aç'}</button>
                : '—',
            ])}
          />
        )}
      </Card>
      {roles.sell ? (
        <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
          <h2 className="font-serif text-2xl md:col-span-2">Yeni görev</h2>
          <Field label="Başlık"><TextInput name="title" required /></Field>
          <Field label="Termin"><TextInput name="dueOn" type="date" defaultValue={today()} /></Field>
          <Field label="Hesap">
            <Select name="accountId" defaultValue="">
              <option value="">—</option>
              {(accounts.data ?? []).map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}
            </Select>
          </Field>
          <Field label="Fırsat">
            <Select name="dealId" defaultValue="">
              <option value="">—</option>
              {(deals.data ?? []).map((deal) => <option key={deal._id} value={deal._id}>{deal.title}</option>)}
            </Select>
          </Field>
          {roles.manage ? (
            <Field label="Atanan">
              <Select name="assigneeId" defaultValue={me.data?._id}>
                {(people.data ?? []).map((person) => (
                  <option key={person._id} value={person._id}>{person.name || person.username}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <div className="md:col-span-2"><Button type="submit">Görevi aç</Button></div>
        </form>
      ) : null}
    </Page>
  )
}

export function People() {
  const people = useRead<Person>('crm.listPeople')
  const members = useRead<Membership>('crm.listMemberships')
  const emails = useRead<EmailRow>('crm.listEmails')
  const refresh = useRefresh()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [username, setUsername] = useState('')
  const mailOf = (userId: string | null) => emails.data?.find((row) => row.userId === userId && row.primary)?.email
  const email = `beyza.koroglu.97+${username.trim()}@gmail.com`

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const handle = username.trim()
    setPending(true)
    setError(null)
    try {
      const created = await write<{ _id: string }>('auth.createAccount', {
        email: `beyza.koroglu.97+${handle}@gmail.com`,
        username: handle,
        name: String(data.get('name')),
      })
      const userId = created[0]?._id
      if (userId) await write('crm.assignRole', { userId, role: String(data.get('role')) })
      event.currentTarget.reset()
      setUsername('')
      await refresh('crm.listPeople', 'crm.listMemberships', 'crm.listEmails')
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setPending(false)
    }
  }

  async function remove(id: string) {
    setError(null)
    try {
      await write('crm.removeMembership', { id })
      await refresh('crm.listMemberships')
    } catch (cause) {
      setError(errorText(cause))
    }
  }

  return (
    <Page title="Ekip" lede="Her hesap beyza.koroglu.97+kullanıcı@gmail.com adresine parola kurma mektubuyla açılır.">
      {error ? <div className="mb-4"><Banner>{error}</Banner></div> : null}
      <Card className="mb-4">
        {(people.data ?? []).length === 0 ? <Empty>Kişi yok.</Empty> : (
          <Table
            columns={['Ad', 'Kullanıcı', 'E-posta', 'Roller']}
            rows={(people.data ?? []).map((person) => [
              person.name ?? '—',
              person.username ?? '—',
              mailOf(person._id) ?? '—',
              (members.data ?? []).filter((row) => row.userId === person._id).map((row) => label(row.roleName)).join(', ') || '—',
            ])}
          />
        )}
      </Card>
      <Card>
        <h2 className="px-4 pt-4 font-medium">Üyelikler</h2>
        {(members.data ?? []).length === 0 ? <Empty>Rol atanmış kişi yok.</Empty> : (
          <Table
            columns={['Kişi', 'Rol', '']}
            rows={(members.data ?? []).map((row) => [
              row.user ?? '—',
              label(row.roleName),
              <button className="text-rose-800" onClick={() => void remove(row._id)}>Kaldır</button>,
            ])}
          />
        )}
      </Card>
      <form onSubmit={(event) => void create(event)} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-2">
        <h2 className="font-serif text-2xl md:col-span-2">Hesap aç</h2>
        <Field label="Ad"><TextInput name="name" required /></Field>
        <Field label="Kullanıcı adı">
          <TextInput name="username" required pattern="[A-Za-z0-9._-]+" value={username} onChange={(event) => setUsername(event.target.value)} />
        </Field>
        <p className="self-end text-sm text-stone-500 md:col-span-2">{username.trim() ? email : 'Adres, kullanıcı adından kurulur.'}</p>
        <Field label="Rol">
          <Select name="role" defaultValue="satis">
            {roleNames.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>{pending ? 'Açılıyor…' : 'Hesabı aç ve mektup gönder'}</Button>
        </div>
      </form>
    </Page>
  )
}

export function Inbox() {
  const inbox = useQuery(wyndbase.inbox.unread.options())
  const items = [
    ...(inbox.data?.list.assignments ?? []),
    ...(inbox.data?.list.notifications ?? []),
    ...(inbox.data?.list.alerts ?? []),
  ]

  return (
    <Page title="Gelen" lede="Size atanan kayıtlar burada görünür. Atama, sahip veya görev değişince gelir.">
      <Card>
        {items.length === 0 ? <Empty>Okunmamış kayıt yok.</Empty> : (
          <Table
            columns={['Başlık', 'Açıklama', 'Zaman']}
            rows={items.map((item) => [item.title, item.description ?? '—', item.occurredAt.slice(0, 16).replace('T', ' ')])}
          />
        )}
      </Card>
      <div className="mt-4">
        <Button tone="ghost" onClick={() => void wyndbase.inbox.markAllSeen()}>Hepsini okundu say</Button>
      </div>
    </Page>
  )
}
