import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, Home, LogIn, Search, ShoppingCart, User as UserIcon, WifiOff } from 'lucide-react'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from './brand-icons'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cartCount, useCart } from '@/features/cart/hooks'
import { useSession } from '@/lib/session-store'
import { useConnectionState } from '@/realtime/realtime'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const container = 'mx-auto w-full max-w-[1232px] px-4 md:px-4'

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('rounded-sm text-sm font-bold tracking-[0.1em]', className)} aria-label="Kurio — página inicial">
      KURIO
    </Link>
  )
}

function CartLink({ className, iconClass }: { className?: string; iconClass?: string }) {
  const { data } = useCart()
  const count = cartCount(data)
  return (
    <Link
      to="/carrinho"
      className={cn('relative inline-flex size-10 items-center justify-center rounded-md hover:bg-white/5', className)}
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
      data-testid="cart-link"
    >
      <ShoppingCart className={cn('size-6', iconClass)} aria-hidden="true" />
      {count > 0 && (
        <span aria-hidden="true" data-testid="cart-count" className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  )
}

/** Itens fora do escopo (Criadores, Aprenda): visíveis, mas sem aparentar funcionalidade. */
function SoonLink({ label }: { label: string }) {
  return (
    <span aria-disabled="true" title="Em breve" className="cursor-not-allowed px-1 py-2 text-foreground/80">
      {label}
      <span className="sr-only"> (em breve)</span>
    </span>
  )
}

/** Busca global — o próprio gatilho fica dentro do Dialog para o foco voltar a ele ao fechar. */
function SearchDialog({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const [open, onOpenChange] = useState(false)
  const [value, setValue] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onOpenChange(false)
    void navigate({ to: '/mercado', search: value.trim() ? { q: value.trim() } : {} })
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Buscar NFTs</DialogTitle>
        <DialogDescription>Pesquise por nome, coleção ou criador.</DialogDescription>
        <form onSubmit={submit} role="search" className="mt-6 flex gap-2">
          <label htmlFor="global-search" className="sr-only">Termo de busca</label>
          <Input id="global-search" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex.: Emerald Ape" />
          <Button type="submit" size="md">Buscar</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function Header() {
  const { user } = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marketActive = pathname.startsWith('/mercado') || pathname.startsWith('/nft') || pathname.startsWith('/carrinho') || pathname.startsWith('/pagamento')
  const navCls = (active: boolean) =>
    cn('relative px-1 py-2 hover:text-accent', active && 'font-bold text-accent after:absolute after:inset-x-0 after:-bottom-[15px] after:h-[3px] after:bg-primary')

  return (
    <header className="bg-background">
      <a href="#conteudo" className="sr-only-focusable absolute left-4 top-2 z-50 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">
        Pular para o conteúdo
      </a>
      <div className={cn(container, 'hidden md:block')}>
        <div className="flex h-[68px] items-center justify-between border-b border-border pt-6 pb-4">
          <Logo />
          <nav aria-label="Principal" className="flex items-center gap-10 text-[15px]">
            <Link to="/" className={navCls(pathname === '/')}>Início</Link>
            <Link to="/mercado" className={navCls(marketActive)}>Mercado</Link>
            <SoonLink label="Criadores" />
            <SoonLink label="Aprenda" />
          </nav>
          <div className="flex items-center gap-4">
            <SearchDialog>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-white/5" aria-label="Buscar">
                <Search className="size-6" aria-hidden="true" />
              </button>
            </SearchDialog>
            <CartLink />
            {user ? (
              <Link to="/conta/perfil" className="flex h-[35px] items-center gap-2 rounded-sm bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-hover" data-testid="account-link">
                <UserIcon className="size-5" aria-hidden="true" />
                <span className="max-w-28 truncate">{user.name.split(' ')[0]}</span>
              </Link>
            ) : (
              <Link to="/login" search={{ redirect: pathname }} className="flex h-[35px] items-center gap-1.5 rounded-sm bg-primary px-2.5 text-base text-primary-foreground hover:bg-primary-hover">
                <LogIn className="size-5" aria-hidden="true" /> Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* Mobile: busca no topo (frame "Mobile / Início") */}
      <div className="flex items-center gap-2 px-4 pt-4 md:hidden">
        <Logo className="mr-1" />
        <SearchDialog>
          <button type="button" className="flex h-11 flex-1 items-center gap-2 rounded-md bg-surface px-3 text-left text-sm text-muted">
            <Search className="size-5" aria-hidden="true" /> Explorar coleções
          </button>
        </SearchDialog>
      </div>
      <ConnectionBanner />
    </header>
  )
}

/** Barra de navegação inferior (frame "Mobile / Início"). */
export function MobileTabBar() {
  const { user } = useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const item = (active: boolean) => cn('flex size-12 flex-col items-center justify-center rounded-md text-muted', active && 'text-accent')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
      <div className="mx-auto flex max-w-[414px] items-center justify-around px-4 pb-[env(safe-area-inset-bottom)] pt-1">
        <Link to="/" className={item(pathname === '/')} aria-label="Início"><Home className="size-5" aria-hidden="true" /></Link>
        <Link to="/favoritos" className={item(pathname === '/favoritos')} aria-label="Favoritos"><Heart className="size-5" aria-hidden="true" /></Link>
        <CartLink className={item(pathname === '/carrinho')} iconClass="size-5" />
        <Link to={user ? '/conta/perfil' : '/login'} className={item(pathname.startsWith('/conta'))} aria-label={user ? 'Meu perfil' : 'Entrar'}>
          <UserIcon className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </nav>
  )
}

function ConnectionBanner() {
  const state = useConnectionState()
  return (
    <div role="status" aria-live="polite">
      {state === 'reconnecting' && (
        <p className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-center text-sm text-warning" data-testid="realtime-reconnecting">
          <WifiOff className="size-4" aria-hidden="true" /> Tempo real interrompido — reconectando…
        </p>
      )}
    </div>
  )
}

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

function Newsletter() {
  const [email, setEmail] = useState('')
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        // Newsletter está fora do escopo: não simulamos sucesso funcional.
        toast.info('Inscrição na newsletter indisponível nesta demonstração.')
      }}
    >
      <h2 className="text-base font-bold leading-4">Antecipe-se ao próximo lançamento</h2>
      <div className="flex">
        <label htmlFor="newsletter" className="sr-only">E-mail para novidades</label>
        <input
          id="newsletter"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          className="h-10 min-w-0 flex-1 rounded-l-md bg-surface-2 px-3 text-sm text-foreground placeholder:text-caption"
        />
        <button type="submit" className="h-10 rounded-r-md bg-primary px-4 font-bold text-primary-foreground hover:bg-primary-hover">Enviar</button>
      </div>
      <p className="text-[13px] leading-[22px] text-muted">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}

export function Footer() {
  const soon = 'cursor-not-allowed text-sm text-foreground/85'
  return (
    <footer className={cn(container, 'mt-24 pb-24 md:pb-6')}>
      <div className="rounded-sm bg-surface">
        <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          {FEATURES.map((f) => (
            <div key={f.letter} className="flex flex-col gap-3 lg:border-r lg:border-primary lg:pr-6">
              <span aria-hidden="true" className="grid size-[74px] place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                {f.letter}
              </span>
              <h2 className="text-base font-bold">{f.title}</h2>
              <p className="text-sm leading-[22px] text-muted">{f.text}</p>
            </div>
          ))}
          <Newsletter />
        </div>
        <div className="grid gap-4 bg-surface-2 px-8 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <span className="font-bold tracking-[0.1em]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-accent">contato@email.com</a>
          <a href="tel:+551140028922" className="hover:text-accent">+55 11 4002 8922</a>
        </div>
        <div className="grid gap-8 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          <nav aria-label="Meu perfil" className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Meu perfil</h2>
            <Link to="/conta/perfil" className="text-sm hover:text-accent">Meu perfil</Link>
            <Link to="/favoritos" className="text-sm hover:text-accent">Lista de interesse</Link>
            <Link to="/conta/carteiras" className="text-sm hover:text-accent">Carteiras</Link>
            <span aria-disabled="true" className={soon}>Atividade<span className="sr-only"> (em breve)</span></span>
          </nav>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Central de ajuda</h2>
            {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((l) => (
              <span key={l} aria-disabled="true" className={soon}>{l}<span className="sr-only"> (em breve)</span></span>
            ))}
          </div>
          <nav aria-label="Coleções" className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Coleções</h2>
            {[
              ['Arte digital', 'digital-art'],
              ['Fotografia', 'photography'],
              ['Música', 'music'],
              ['Arte 3D', '3d'],
              ['Utilidade', 'utility'],
            ].map(([l, v]) => (
              <Link key={v} to="/mercado" search={{ category: [v] as never }} className="text-sm hover:text-accent">{l}</Link>
            ))}
          </nav>
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Redes sociais</h2>
            <ul className="flex gap-2">
              {[
                [Facebook, 'Facebook', 'https://facebook.com'],
                [Instagram, 'Instagram', 'https://instagram.com'],
                [Twitter, 'X (Twitter)', 'https://x.com'],
                [Linkedin, 'LinkedIn', 'https://linkedin.com'],
                [Youtube, 'YouTube', 'https://youtube.com'],
              ].map(([Icon, label, href]) => {
                const I = Icon as typeof Facebook
                return (
                  <li key={label as string}>
                    <a href={href as string} target="_blank" rel="noopener noreferrer" aria-label={`${label} (abre em nova aba)`} className="grid size-8 place-items-center rounded-sm border border-primary text-primary hover:bg-primary/10">
                      <I className="size-4" aria-hidden="true" />
                    </a>
                  </li>
                )
              })}
            </ul>
            <h2 className="mt-4 text-lg font-bold">Carteiras compatíveis</h2>
            <WalletChips />
          </div>
        </div>
      </div>
      <p className="py-5 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
    </footer>
  )
}

export function WalletChips({ className }: { className?: string }) {
  return (
    <p className={cn('inline-flex w-fit items-center gap-2 rounded-sm border border-border-soft bg-surface-2 px-2 py-1 text-[9px] font-bold tracking-[0.04em] text-accent', className)}>
      METAMASK <span aria-hidden="true">•</span> WALLETCONNECT <span aria-hidden="true">•</span> COINBASE
    </p>
  )
}

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-sm font-bold">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <li key={it.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {it.to ? (
              <Link to={it.to} className="hover:text-accent">{it.label}</Link>
            ) : (
              <span aria-current="page">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
