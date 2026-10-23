import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, AlertTriangle, Download, Heart, Image as ImageIcon, LogOut, MapPin, Tag, User } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { accountApi } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import { qk } from '@/api/query'
import { Field, focusFirstInvalid, FormError } from '@/components/field'
import { container } from '@/components/layout'
import { ErrorState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input, InputWithSuffix, NativeSelect, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Network, UpsertWalletRequest, User as UserT, Wallet, WalletProvider, WalletRole } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { useLogout } from '@/features/auth/hooks'
import { useWallets } from '@/features/checkout/hooks'
import { sessionStore, useSession } from '@/lib/session-store'
import { cn } from '@/lib/utils'
import { PasswordInput } from './auth'

function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const logout = useLogout()
  const navigate = useNavigate()
  // mesmo padding em todos os itens, inclusive "Sair" (escala de 8px)
  const row = 'flex w-full items-center gap-3 border-l-[6px] border-transparent px-5 py-4 text-[15px] text-accent'
  const item = (active: boolean) => cn(row, 'hover:bg-white/5', active && 'border-primary')
  const soon = cn(row, 'cursor-not-allowed text-accent/70')
  return (
    <div className={cn(container, 'mt-8 grid gap-8 md:grid-cols-[310px_1fr]')}>
      <nav aria-label="Minha conta" className="h-fit rounded-sm bg-surface pt-6">
        <h2 className="px-6 pb-4 text-lg font-bold">Meu perfil</h2>
        <ul>
          <li><Link to="/conta/perfil" className={item(pathname === '/conta/perfil')} aria-current={pathname === '/conta/perfil' ? 'page' : undefined}><User className="size-4" aria-hidden="true" />Dados do perfil</Link></li>
          <li><Link to="/conta/carteiras" className={item(pathname === '/conta/carteiras')} aria-current={pathname === '/conta/carteiras' ? 'page' : undefined}><MapPin className="size-4" aria-hidden="true" />Carteiras</Link></li>
          <li><span aria-disabled="true" className={soon}><Activity className="size-4" aria-hidden="true" />Atividade<span className="sr-only"> (em breve)</span></span></li>
          <li><Link to="/favoritos" className={item(false)}><Heart className="size-4" aria-hidden="true" />Lista de interesse</Link></li>
          <li><span aria-disabled="true" className={soon}><Tag className="size-4" aria-hidden="true" />Ofertas<span className="sr-only"> (em breve)</span></span></li>
          <li><span aria-disabled="true" className={soon}><Download className="size-4" aria-hidden="true" />Arquivos baixados<span className="sr-only"> (em breve)</span></span></li>
          <li><span aria-disabled="true" className={soon}><AlertTriangle className="size-4" aria-hidden="true" />Suporte<span className="sr-only"> (em breve)</span></span></li>
        </ul>
        <button
          type="button"
          onClick={async () => {
            await logout.mutateAsync()
            toast.success('Você saiu da sua conta.')
            void navigate({ to: '/' })
          }}
          className={cn(row, 'border-t border-t-border font-bold hover:bg-white/5')}
          data-testid="logout"
        >
          <LogOut className="size-4" aria-hidden="true" /> Sair
        </button>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// ---------------- Perfil ----------------
async function resizeAvatar(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) throw new Error('Envie uma imagem PNG, JPG ou WEBP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 5 MB.')
  const bitmap = await createImageBitmap(file)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const s = Math.min(bitmap.width, bitmap.height)
  ctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, size, size)
  return canvas.toDataURL('image/webp', 0.85)
}

function useProfile() {
  const { user } = useSession()
  return useQuery({ queryKey: qk.profile(user?.id ?? 'anon'), queryFn: ({ signal }) => accountApi.profile(signal), enabled: Boolean(user) })
}

function ProfileForm({ profile }: { profile: UserT }) {
  const qc = useQueryClient()
  const formRef = useRef<HTMLFormElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    name: profile.name,
    username: profile.username,
    email: profile.email,
    ens: (profile.ensName ?? '').replace(/\.eth$/, ''),
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: accountApi.updateProfile,
    onSuccess: (user) => {
      qc.setQueryData(qk.profile(user.id), user)
      sessionStore.setUser(user)
      toast.success('Perfil atualizado.')
    },
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Informe o nome de exibição.'
    if (!/^[a-z0-9_.]{3,24}$/.test(form.username)) next.username = 'Use 3–24 caracteres: letras minúsculas, números, _ ou .'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Informe um e-mail válido.'
    if (form.ens && !/^[a-z0-9-]{2,}(\.[a-z0-9-]+)*$/.test(form.ens)) next.ensName = 'Use letras minúsculas, números, hífen ou ponto (ex.: nome ou nome.kurio).'
    if (form.bio.length > 280) next.bio = 'Máximo de 280 caracteres.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current)
    try {
      await save.mutateAsync({ name: form.name.trim(), username: form.username, email: form.email.trim(), ensName: form.ens ? `${form.ens}.eth` : null, bio: form.bio, avatarUrl: form.avatarUrl })
    } catch (err) {
      if (isApiError(err)) {
        setErrors(err.fields)
        if (!Object.keys(err.fields).length) setFormError(err.message)
      }
      focusFirstInvalid(formRef.current)
    }
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      const url = await resizeAvatar(file)
      setForm((f) => ({ ...f, avatarUrl: url }))
      setErrors((e) => ({ ...e, avatarUrl: '' }))
    } catch (err) {
      setErrors((e) => ({ ...e, avatarUrl: (err as Error).message }))
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="profile-title" className="flex flex-col gap-6">
      <h1 id="profile-title" className="text-[15px] font-bold">Perfil do colecionador</h1>
      <FormError message={formError} />
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <Field label="Nome de exibição *" error={errors.name}>
          {(p) => <Input {...p} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}
        </Field>
        <Field label="Nome de usuário *" error={errors.username}>
          {(p) => <Input {...p} autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />}
        </Field>
        <Field label="E-mail *" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
        </Field>
        <Field label="Nome ENS" error={errors.ensName} hint="Opcional. O sufixo .eth é adicionado automaticamente.">
          {(p) => <InputWithSuffix {...p} suffix=".eth" value={form.ens} onChange={(e) => setForm({ ...form, ens: e.target.value.toLowerCase() })} placeholder="seunome" />}
        </Field>
        <Field label="Bio" error={errors.bio}>
          {(p) => <Textarea {...p} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="min-h-11" rows={2} />}
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold" id="avatar-label">Avatar</span>
          <div className="flex items-center gap-5" role="group" aria-labelledby="avatar-label">
            {form.avatarUrl ? (
              <img src={form.avatarUrl} alt="Pré-visualização do avatar" width={50} height={50} className="size-[50px] rounded-full object-cover" data-testid="avatar-preview" />
            ) : (
              <span className="grid size-[50px] place-items-center rounded-full border border-border-soft bg-surface-2 text-accent" aria-label="Sem avatar" role="img">
                <ImageIcon className="size-6" aria-hidden="true" />
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" id="avatar-file" onChange={(e) => onFile(e.target.files?.[0])} aria-describedby={errors.avatarUrl ? 'avatar-error' : undefined} />
            <Button size="sm" className="h-10 w-28 px-0 text-center" onClick={() => fileRef.current?.click()}>Alterar</Button>
            <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, avatarUrl: null })} disabled={!form.avatarUrl}>Remover</Button>
          </div>
          {errors.avatarUrl && <p id="avatar-error" role="alert" className="text-sm text-danger">{errors.avatarUrl}</p>}
        </div>
      </div>
      <Button type="submit" size="sm" className="h-10 w-fit px-10" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar'}</Button>
    </form>
  )
}

function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const change = useMutation({ mutationFn: accountApi.changePassword })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: Record<string, string> = {}
    if (!form.current) errs.currentPassword = 'Informe a senha atual.'
    if (form.next.length < 8 || !/[A-Za-z]/.test(form.next) || !/\d/.test(form.next)) errs.newPassword = 'Mínimo de 8 caracteres, com letras e números.'
    if (form.confirm !== form.next) errs.confirm = 'As senhas não conferem.'
    setErrors(errs)
    if (Object.keys(errs).length) return focusFirstInvalid(formRef.current)
    try {
      await change.mutateAsync({ currentPassword: form.current, newPassword: form.next })
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Senha alterada com sucesso.')
    } catch (err) {
      if (isApiError(err)) setErrors(Object.keys(err.fields).length ? err.fields : { currentPassword: err.message })
      focusFirstInvalid(formRef.current)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate aria-labelledby="password-title" className="flex max-w-[417px] flex-col gap-5 border-t border-border pt-8">
      <h2 id="password-title" className="text-base font-bold">Alterar senha</h2>
      <Field label="Senha atual" error={errors.currentPassword}>
        {(p) => <PasswordInput {...p} autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />}
      </Field>
      <Field label="Nova senha" error={errors.newPassword}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />}
      </Field>
      <Field label="Confirmar nova senha" error={errors.confirm}>
        {(p) => <PasswordInput {...p} autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />}
      </Field>
      <Button type="submit" size="md" className="w-full" disabled={change.isPending}>{change.isPending ? 'Salvando…' : 'Salvar nova senha'}</Button>
    </form>
  )
}

export function ProfilePage() {
  const profile = useProfile()
  return (
    <AccountLayout>
      {profile.isPending ? (
        <div className="grid gap-6 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <div className="flex flex-col gap-10">
          <ProfileForm key={profile.dataUpdatedAt} profile={profile.data} />
          <PasswordForm />
        </div>
      )}
    </AccountLayout>
  )
}

// ---------------- Carteiras ----------------
const PROVIDERS: { value: WalletProvider; label: string }[] = [
  { value: 'metamask', label: 'MetaMask' },
  { value: 'walletconnect', label: 'WalletConnect' },
  { value: 'coinbase', label: 'Coinbase Wallet' },
]

type WalletForm = { label: string; provider: WalletProvider | ''; network: Network | ''; address: string; ens: string }
const emptyForm: WalletForm = { label: '', provider: '', network: '', address: '', ens: '' }
const toForm = (w?: Wallet | null): WalletForm => (w ? { label: w.label, provider: w.provider, network: w.network, address: w.address, ens: (w.ensName ?? '').replace(/\.eth$/, '') } : emptyForm)

function WalletEditor({ role, wallet, primary }: { role: WalletRole; wallet: Wallet | null; primary: Wallet | null }) {
  const qc = useQueryClient()
  const { user } = useSession()
  const formRef = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(Boolean(wallet) || role === 'primary')
  const [form, setForm] = useState<WalletForm>(toForm(wallet))
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  useEffect(() => setForm(toForm(wallet)), [wallet])

  const save = useMutation({
    mutationFn: (body: UpsertWalletRequest) => (wallet ? accountApi.updateWallet(wallet.id, body) : accountApi.createWallet(body)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.wallets(user!.id) })
      toast.success(`Carteira ${role === 'primary' ? 'principal' : 'secundária'} salva.`)
    },
  })

  const applySame = (on: boolean) => {
    setSameAsPrimary(on)
    setOpen(true)
    if (on && primary) setForm((f) => ({ ...f, provider: primary.provider, network: primary.network }))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (form.label.trim().length < 2) next.label = 'Informe um apelido para a carteira.'
    if (!form.provider) next.provider = 'Selecione o tipo de carteira.'
    if (!form.network) next.network = 'Selecione uma rede.'
    const addrOk = form.network === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(form.address) : /^0x[a-fA-F0-9]{40}$/.test(form.address)
    if (!addrOk) next.address = form.network === 'solana' ? 'Endereço Solana inválido.' : 'Endereço inválido (0x + 40 caracteres hexadecimais).'
    if (form.ens && !/^[a-z0-9-]{2,}(\.[a-z0-9-]+)*$/.test(form.ens)) next.ensName = 'Use letras minúsculas, números, hífen ou ponto (ex.: nome ou nome.kurio).'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current)
    try {
      await save.mutateAsync({ label: form.label.trim(), provider: form.provider as WalletProvider, network: form.network as Network, address: form.address.trim(), ensName: form.ens ? `${form.ens}.eth` : null, role })
    } catch (err) {
      if (isApiError(err)) {
        setErrors(err.fields)
        if (!Object.keys(err.fields).length || err.status === 409) setFormError(err.message)
      }
      focusFirstInvalid(formRef.current)
    }
  }

  const title = role === 'primary' ? 'Carteira principal' : 'Carteira secundária'
  const fid = `wallet-${role}`
  return (
    <section aria-labelledby={`${fid}-title`} className="flex flex-col gap-5" data-testid={`${fid}-section`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id={`${fid}-title`} className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-muted">
            {role === 'primary' ? 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.' : !wallet && !open ? 'Você ainda não adicionou uma carteira secundária.' : 'Usada como alternativa no pagamento.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {role === 'secondary' && primary && !wallet && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={sameAsPrimary} onCheckedChange={(v) => applySame(v === true)} /> Igual à carteira principal
            </label>
          )}
          {!open && <Button variant="link" className="font-bold" onClick={() => setOpen(true)}>Adicionar</Button>}
        </div>
      </div>
      {open && (
        <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6" aria-label={title}>
          <FormError message={formError} />
          <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
            <Field label="Apelido da carteira *" error={errors.label}>
              {(p) => <Input {...p} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex.: Principal" />}
            </Field>
            <Field label="Tipo de carteira *" error={errors.provider}>
              {(p) => (
                <NativeSelect {...p} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as WalletProvider })}>
                  <option value="">Selecione uma carteira</option>
                  {PROVIDERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </NativeSelect>
              )}
            </Field>
            <Field label="Rede *" error={errors.network}>
              {(p) => (
                <NativeSelect {...p} value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value as Network })}>
                  <option value="">Selecione uma rede</option>
                  {NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                </NativeSelect>
              )}
            </Field>
            <Field label="Endereço da carteira *" error={errors.address}>
              {(p) => <Input {...p} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value.trim() })} placeholder="Endereço 0x da carteira" spellCheck={false} />}
            </Field>
            <Field label="Nome ENS (opcional)" error={errors.ensName}>
              {(p) => <InputWithSuffix {...p} suffix=".eth" value={form.ens} onChange={(e) => setForm({ ...form, ens: e.target.value.toLowerCase() })} placeholder="seunome" />}
            </Field>
          </div>
          <Button type="submit" size="sm" className="h-10 w-fit px-3" disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar carteira'}</Button>
        </form>
      )}
    </section>
  )
}

export function WalletsPage() {
  const wallets = useWallets()
  const primary = wallets.data?.find((w) => w.role === 'primary') ?? null
  const secondary = wallets.data?.find((w) => w.role === 'secondary') ?? null
  return (
    <AccountLayout>
      <h1 className="sr-only">Carteiras</h1>
      {wallets.isPending ? (
        <div className="grid gap-6 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : wallets.isError ? (
        <ErrorState error={wallets.error} onRetry={() => wallets.refetch()} />
      ) : (
        <div className="flex flex-col gap-12">
          <WalletEditor role="primary" wallet={primary} primary={primary} />
          <WalletEditor role="secondary" wallet={secondary} primary={primary} />
        </div>
      )}
    </AccountLayout>
  )
}
