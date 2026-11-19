export type Account = {
  _id: string
  name: string
  industry: string | null
  website: string | null
  phone: string | null
  city: string | null
  status: string
  owner: string | null
  ownerId: string | null
}

export type Contact = {
  _id: string
  name: string
  email: string | null
  phone: string | null
  jobTitle: string | null
  account: string | null
  accountId: string | null
  owner: string | null
  ownerId: string | null
}

export type Deal = {
  _id: string
  title: string
  amount: string
  currency: string
  stage: string
  closeDate: string | null
  notes: string | null
  account: string | null
  accountId: string | null
  contact: string | null
  contactId: string | null
  owner: string | null
  ownerId: string | null
}

export type Activity = {
  _id: string
  kind: string
  subject: string
  body: string | null
  occurredOn: string
  account: string | null
  accountId: string | null
  contact: string | null
  contactId: string | null
  deal: string | null
  dealId: string | null
  owner: string | null
  ownerId: string | null
}

export type Task = {
  _id: string
  title: string
  dueOn: string | null
  status: string
  notes: string | null
  account: string | null
  accountId: string | null
  deal: string | null
  dealId: string | null
  assignee: string | null
  assigneeId: string | null
}

export type PipelineRow = { stage: string; n: number | string; total: string }
export type Person = { _id: string; username: string | null; name: string | null }
export type Membership = { _id: string; user: string | null; userId: string | null; roleName: string }
export type EmailRow = { _id: string; email: string; primary: boolean | null; userId: string | null }

export const industries = [
  ['technology', 'Teknoloji'],
  ['finance', 'Finans'],
  ['manufacturing', 'Üretim'],
  ['retail', 'Perakende'],
  ['services', 'Hizmet'],
  ['other', 'Diğer'],
] as const

export const accountStatuses = [
  ['prospect', 'Aday'],
  ['active', 'Aktif'],
  ['inactive', 'Pasif'],
] as const

export const stages = [
  ['lead', 'Aday'],
  ['qualified', 'Nitelikli'],
  ['proposal', 'Teklif'],
  ['negotiation', 'Görüşme'],
  ['won', 'Kazanıldı'],
  ['lost', 'Kaybedildi'],
] as const

export const currencies = [
  ['TRY', 'TRY'],
  ['USD', 'USD'],
  ['EUR', 'EUR'],
] as const

export const activityKinds = [
  ['call', 'Arama'],
  ['meeting', 'Toplantı'],
  ['email', 'E-posta'],
  ['note', 'Not'],
] as const

export const taskStatuses = [
  ['open', 'Açık'],
  ['done', 'Bitti'],
] as const

export const roleNames = [
  ['yonetici', 'Yönetici'],
  ['satis_muduru', 'Satış müdürü'],
  ['satis', 'Satış'],
  ['izleyici', 'İzleyici'],
] as const

const labels = new Map<string, string>([
  ...industries,
  ...accountStatuses,
  ...stages,
  ...currencies,
  ...activityKinds,
  ...taskStatuses,
  ...roleNames,
])

export function label(key: string | null | undefined) {
  if (!key) return '—'
  return labels.get(key) ?? key
}

export function money(value: string | number | null | undefined, currency = 'TRY') {
  const amount = Number(value ?? 0)
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function blank(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  return text ? text : null
}

export function moves(stage: string, manage: boolean) {
  const open = {
    lead: ['qualified', 'lost'],
    qualified: ['proposal', 'lost'],
    proposal: ['negotiation', 'qualified', 'lost'],
    negotiation: manage ? ['won', 'proposal', 'lost'] : ['proposal', 'lost'],
    won: manage ? ['negotiation'] : [],
    lost: [],
  } as Record<string, string[]>
  return open[stage] ?? []
}
