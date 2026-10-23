import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { Facebook } from '@/components/brand-icons'
import { useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Field, focusFirstInvalid, FormError } from '@/components/field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { closeAuthTarget, safeRedirect, useLogin, useRegister } from '@/features/auth/hooks'
import { HomePage } from './home'
import { cn } from '@/lib/utils'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * O que a pessoa digitar vira um @usuário válido para a API (a–z, 0–9, _ e .):
 * "Nicolas Martínez" → "nicolas.martinez". O texto original vira o nome de exibição.
 */
function toUsername(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24)
}

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className={cn('pr-11', props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1.5 text-muted hover:text-foreground"
        aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={show}
      >
        {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  )
}

function SocialButtons() {
  // Login social está fora do escopo — não simulamos sucesso.
  const notAvailable = (provider: string) => toast.info(`Login com ${provider} não está disponível nesta demonstração. Use e-mail e senha.`)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        Ou continue com
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <button type="button" onClick={() => notAvailable('Google')} className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-sm hover:border-border-soft">
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.4-.2-2H12v3.8h6c-.1 1-.8 2.4-2.2 3.4l3.4 2.6c2-1.9 3.4-4.6 3.4-7.8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.4-2.6c-.9.6-2.2 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7l-3.5 2.7C3.9 20.4 7.6 23 12 23z"/><path fill="#FBBC05" d="M5.6 14.1c-.2-.7-.4-1.4-.4-2.1s.1-1.5.4-2.1L2.1 7.2C1.4 8.7 1 10.3 1 12s.4 3.3 1.1 4.8l3.5-2.7z"/><path fill="#EA4335" d="M12 5.2c2.1 0 3.5.9 4.3 1.7l3.1-3C17.5 2.1 15 1 12 1 7.6 1 3.9 3.6 2.1 7.2l3.5 2.7C6.5 7.2 9 5.2 12 5.2z"/></svg>
        Continuar com Google
      </button>
      <button type="button" onClick={() => notAvailable('Facebook')} className="flex h-10 items-center justify-center gap-3 rounded-sm border border-border text-sm hover:border-border-soft">
        <Facebook className="size-5 text-[#1877F2]" aria-hidden="true" /> Continuar com Facebook
      </button>
    </div>
  )
}

function AuthShell({ mode, children, description }: { mode: 'login' | 'register'; children: React.ReactNode; description: string }) {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { redirect?: string }
  const close = () => void navigate({ to: closeAuthTarget(search.redirect) as '/' })
  const tab = 'text-[17px] md:text-xl'
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none hidden md:block">
        <HomePage />
      </div>
      <Dialog open onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-md:inset-0 max-md:h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:bg-background max-md:pt-12 md:max-w-[500px] md:border-b-[10px] md:border-b-primary">
          <p className="mb-10 text-center text-3xl font-bold tracking-[0.1em] md:hidden" aria-hidden="true">KURIO</p>
          <DialogTitle className="flex justify-center gap-3 pr-0 text-center font-normal">
            <Link to="/login" search={search} className={cn(tab, mode === 'login' ? 'text-accent' : 'max-md:hidden')} aria-current={mode === 'login' ? 'page' : undefined}>
              Entrar
            </Link>
            <span className="text-primary max-md:hidden" aria-hidden="true">|</span>
            <Link to="/cadastro" search={search} className={cn(tab, mode === 'register' ? 'text-accent' : 'max-md:hidden')} aria-current={mode === 'register' ? 'page' : undefined}>
              {mode === 'register' ? <span><span className="md:hidden">Criar perfil de colecionador</span><span className="max-md:hidden">Criar conta</span></span> : 'Criar conta'}
            </Link>
          </DialogTitle>
          <DialogDescription className="mx-auto mt-6 max-w-[404px] text-center text-xs text-foreground max-md:sr-only">{description}</DialogDescription>
          <div className="mx-auto mt-8 flex max-w-[340px] flex-col gap-6">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function LoginPage() {
  const search = useSearch({ from: '/login' })
  const navigate = useNavigate()
  const login = useLogin()
  const formRef = useRef<HTMLFormElement>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!EMAIL_RE.test(email.trim())) next.email = 'Informe um e-mail válido.'
    if (!password) next.password = 'Informe sua senha.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current)
    try {
      const session = await login.mutateAsync({ email: email.trim(), password })
      toast.success(`Bem-vindo(a), ${session.user.name.split(' ')[0]}!`)
      void navigate({ to: safeRedirect(search.redirect) as '/', replace: true })
    } catch (err) {
      if (isApiError(err)) {
        setErrors(err.fields)
        setFormError(err.code === 'INVALID_CREDENTIALS' || !Object.keys(err.fields).length ? err.message : null)
      } else setFormError('Não foi possível entrar. Tente novamente.')
      focusFirstInvalid(formRef.current)
    }
  }

  return (
    <AuthShell mode="login" description="Entre para gerenciar sua carteira, coleção e perfil de criador.">
      {search.reason === 'expired' && (
        <p role="status" className="rounded-sm border border-warning/50 bg-warning/10 p-3 text-sm text-warning" data-testid="session-expired-notice">
          Sua sessão expirou. Entre novamente para continuar de onde parou.
        </p>
      )}
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Entrar">
        <FormError message={formError} />
        <Field label="E-mail" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder="contato@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Senha" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="current-password" placeholder="•••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <span aria-disabled="true" title="Em breve" className="-mt-2 cursor-not-allowed self-end text-sm text-accent">
          Esqueceu a senha?<span className="sr-only"> (indisponível nesta demonstração)</span>
        </span>
        <Button type="submit" size="md" className="h-11 w-full text-base" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <SocialButtons />
      <p className="text-center text-sm md:hidden">
        Novo na Kurio? <Link to="/cadastro" search={search} className="text-accent underline">Crie uma conta</Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const search = useSearch({ from: '/cadastro' })
  const navigate = useNavigate()
  const register = useRegister()
  const formRef = useRef<HTMLFormElement>(null)
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const displayName = form.username.trim().replace(/\s+/g, ' ')
  const username = toUsername(form.username)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (displayName.length < 2 || username.length < 3) next.username = 'Informe um nome com pelo menos 3 letras ou números.'
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Informe um e-mail válido.'
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) next.password = 'Mínimo de 8 caracteres, com letras e números.'
    if (form.confirm !== form.password) next.confirm = 'As senhas não conferem.'
    setErrors(next)
    setFormError(null)
    if (Object.keys(next).length) return focusFirstInvalid(formRef.current)
    try {
      await register.mutateAsync({ name: displayName, username, email: form.email.trim(), password: form.password })
      toast.success('Conta criada! Bem-vindo(a) à Kurio.')
      void navigate({ to: safeRedirect(search.redirect) as '/', replace: true })
    } catch (err) {
      if (isApiError(err)) {
        setErrors(err.fields)
        if (!Object.keys(err.fields).length) setFormError(err.message)
      } else setFormError('Não foi possível criar a conta.')
      focusFirstInvalid(formRef.current)
    }
  }

  return (
    <AuthShell mode="register" description="Crie seu perfil de colecionador e conecte uma carteira quando quiser.">
      <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Criar conta">
        <FormError message={formError} />
        <Field
          label="Nome de usuário"
          error={errors.username ?? errors.name}
          hint={username.length >= 3 && username !== displayName ? `Seu @usuário será: ${username}` : undefined}
        >
          {(p) => <Input {...p} autoComplete="username" placeholder="Nome de usuário" value={form.username} onChange={set('username')} />}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" placeholder="Digite seu e-mail" value={form.email} onChange={set('email')} />}
        </Field>
        <Field label="Senha" error={errors.password}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Senha" value={form.password} onChange={set('password')} />}
        </Field>
        <Field label="Confirmar senha" error={errors.confirm}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" placeholder="Confirmar senha" value={form.confirm} onChange={set('confirm')} />}
        </Field>
        <Button type="submit" size="md" className="h-11 w-full text-base" disabled={register.isPending}>
          {register.isPending ? 'Criando…' : 'Criar conta'}
        </Button>
      </form>
      <SocialButtons />
      <p className="text-center text-sm md:hidden">
        Já tem uma conta? <Link to="/login" search={search} className="text-accent underline">Entre</Link>
      </p>
    </AuthShell>
  )
}
