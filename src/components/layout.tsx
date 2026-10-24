import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Heart, Home, LogIn, ScanLine, Search, ShoppingCart, User as UserIcon, WifiOff } from 'lucide-react'
import { Facebook, Instagram, Linkedin, Twitter, Youtube } from './brand-icons'
import { useEffect, useState, type FormEvent } from 'react'
import { ThemeToggle } from './theme-toggle'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cartCount, useCart } from '@/features/cart/hooks'
import { CatalogMobileBar } from '@/features/catalog/catalog-section'
import { useSession } from '@/lib/session-store'
import { useIsMobile } from '@/lib/use-media'
import { useMobileChrome } from './mobile-chrome'
import { useConnectionState } from '@/realtime/realtime'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export const container = 'mx-auto w-full max-w-[1232px] px-4 md:px-4'

/** Linha de item (Carrinho, Pagamento e Confirmação): mesmo padding, raio e espaço entre thumbnail e texto. */
export const itemRow = 'items-center gap-x-4 overflow-hidden rounded-sm p-2'
export const itemThumb = 'shrink-0 rounded-sm object-cover'

/** "Voltar" das telas mobile: volta no histórico do app ou, em acesso direto por link, vai para `fallback`. */
export function BackButton({ fallback }: { fallback: '/' | '/carrinho' }) {
  const router = useRouter()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: fallback }))}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-surface transition-colors hover:bg-surface-2"
      aria-label="Voltar"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
    </button>
  )
}

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
      className={cn('relative inline-flex size-10 items-center justify-center rounded-md hover:bg-foreground/5', className)}
      aria-label={`Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`}
      data-testid="cart-link"
    >
      <ShoppingCart className={cn('size-6', iconClass)} aria-hidden="true" />
      {count > 0 && (
        // key muda a cada item: o selo "pula" quando algo entra no carrinho
        <span key={count} aria-hidden="true" data-testid="cart-count" className="absolute right-0 top-0 grid min-w-4 animate-pop place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  )
}

/** Itens fora do escopo (Criadores, Aprenda): visíveis, mas sem aparentar funcionalidade. */
function SoonLink({ label }: { label: string }) {
  return (
    <span aria-disabled="true" title="Em breve" className="flex cursor-not-allowed items-center px-1 text-foreground/80">
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


function useScrolled(offset = 24) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > offset)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [offset])
  return scrolled
}

export function Header() {
  const { user } = useSession()
  const isMobile = useIsMobile()
  const { search } = useMobileChrome()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const marketActive = pathname.startsWith('/mercado') || pathname.startsWith('/nft') || pathname.startsWith('/carrinho') || pathname.startsWith('/pagamento')
  const scrolled = useScrolled()
  // item ocupa a altura toda do header; no hover um sublinhado cresce da esquerda até a borda inferior
  const navCls = (active: boolean) =>
    cn(
      'relative flex items-center border-b-[3px] border-transparent px-1 transition-colors hover:text-accent',
      'after:absolute after:inset-x-0 after:-bottom-[3px] after:h-[3px] after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:after:scale-x-100',
      active && 'border-primary font-bold text-accent',
    )

  return (
    // vidro fosco depois que a página rola
    <header
      className={cn(
        'sticky top-0 z-40 transition-[background-color,box-shadow] duration-300',
        scrolled ? 'bg-background/80 shadow-[0_12px_30px_-20px_rgb(0_0_0/0.6)] backdrop-blur-md' : 'bg-background',
      )}
    >
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute left-4 top-2 z-50 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground">
        Pular para o conteúdo
      </a>
      <div className={cn(container, 'hidden pt-6 md:block')}>
        <div className="flex h-[68px] items-center justify-between border-b border-border">
          <Logo />
          <nav aria-label="Principal" className="flex gap-10 self-stretch text-[15px]">
            <Link to="/" className={navCls(pathname === '/')}>Início</Link>
            <Link to="/mercado" className={navCls(marketActive)}>Mercado</Link>
            <SoonLink label="Criadores" />
            <SoonLink label="Aprenda" />
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <SearchDialog>
              <button type="button" className="inline-flex size-10 items-center justify-center rounded-md hover:bg-foreground/5" aria-label="Buscar">
                <Search className="size-6" aria-hidden="true" />
              </button>
            </SearchDialog>
            <CartLink />
            {user ? (
              <Link to="/conta/perfil" className="flex h-9 items-center gap-2 rounded-sm bg-primary px-3 text-sm font-bold text-primary-foreground hover:bg-primary-hover" data-testid="account-link">
                <UserIcon className="size-4" aria-hidden="true" />
                <span className="max-w-28 truncate">{user.name.split(' ')[0]}</span>
              </Link>
            ) : (
              <Link to="/login" search={{ redirect: pathname }} className="flex h-9 items-center gap-2 rounded-sm bg-primary px-3 text-sm text-primary-foreground hover:bg-primary-hover">
                <LogIn className="size-4" aria-hidden="true" /> Entrar
              </Link>
            )}
          </div>
        </div>
      </div>
      {/* Mobile: busca + filtros no topo das telas de catálogo (frame "Mobile / Início").
          As demais telas mobile têm barra própria com "voltar". */}
      {isMobile && search && <CatalogMobileBar />}
      <ConnectionBanner />
    </header>
  )
}

/** Barra de navegação inferior com botão central em destaque (frame "Mobile / Início"). */
export function MobileTabBar() {
  const { user } = useSession()
  const { tabs } = useMobileChrome()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  if (!tabs) return null
  const item = (active: boolean) => cn('flex size-12 flex-col items-center justify-center rounded-md text-muted transition-colors hover:text-foreground', active && 'text-accent hover:text-accent')
  return (
    <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 bg-surface md:hidden">
      <div className="mx-auto flex h-16 max-w-[414px] items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        <Link to="/" className={item(pathname === '/')} aria-label="Início" aria-current={pathname === '/' ? 'page' : undefined}>
          <Home className="size-[22px]" aria-hidden="true" />
        </Link>
        <Link to="/favoritos" className={item(pathname === '/favoritos')} aria-label="Favoritos" aria-current={pathname === '/favoritos' ? 'page' : undefined}>
          <Heart className="size-[22px]" aria-hidden="true" />
        </Link>
        <Link
          to="/mercado"
          aria-label="Explorar o mercado"
          aria-current={pathname.startsWith('/mercado') ? 'page' : undefined}
          className="-mt-9 grid size-[52px] place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_6px_18px_rgba(0,0,0,0.45)] transition-transform hover:bg-primary-hover active:scale-95"
        >
          <ScanLine className="size-[22px]" aria-hidden="true" />
        </Link>
        <CartLink className={item(pathname === '/carrinho')} iconClass="size-[22px]" />
        <Link to={user ? '/conta/perfil' : '/login'} className={item(pathname.startsWith('/conta'))} aria-label={user ? 'Meu perfil' : 'Entrar'}>
          <UserIcon className="size-[22px]" aria-hidden="true" />
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
      <div className="flex h-11 items-stretch">
        <label htmlFor="newsletter" className="sr-only">E-mail para novidades</label>
        <input
          id="newsletter"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          className="h-full min-w-0 flex-1 rounded-l-md bg-surface-2 px-3 text-sm text-foreground placeholder:text-caption"
        />
        <button type="submit" className="inline-flex h-full items-center rounded-r-md bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary-hover">Enviar</button>
      </div>
      <p className="text-[13px] leading-[22px] text-muted">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
    </form>
  )
}

export function Footer() {
  const soon = 'cursor-not-allowed text-sm text-foreground/85'
  return (
    // Frames mobile não têm rodapé: no celular a navegação fica nas abas inferiores
    <footer className={cn(container, 'mt-24 hidden pb-6 md:block')}>
      <div className="rounded-sm bg-surface">
        <div className="grid gap-8 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
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
        <div className="grid items-center gap-8 bg-surface-2 px-8 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          <span className="font-bold tracking-[0.1em]">KURIO</span>
          <span>Feito para colecionadores, criadores e cultura</span>
          <a href="mailto:contato@email.com" className="hover:text-accent">contato@email.com</a>
          <a href="tel:+551140028922" className="hover:text-accent">+55 11 4002 8922</a>
        </div>
        <div className="grid gap-8 px-8 py-8 sm:grid-cols-2 lg:grid-cols-4 lg:px-12">
          <nav aria-label="Meu perfil" className="flex flex-col gap-3">
            <h2 className="text-lg font-bold">Meu perfil</h2>
            <Link to="/conta/perfil" className="text-sm hover:text-accent">Meu perfil</Link>
            <Link to="/conta/carteiras" className="text-sm hover:text-accent">Minhas carteiras</Link>
            <span aria-disabled="true" className={soon}>Atividade<span className="sr-only"> (em breve)</span></span>
            <span aria-disabled="true" className={soon}>Estúdio do criador<span className="sr-only"> (em breve)</span></span>
            <Link to="/favoritos" className="text-sm hover:text-accent">Lista de interesse</Link>
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
              ['Arte 3D', '3d'],
              ['Arte digital', 'digital-art'],
              ['Fotografia', 'photography'],
              ['Música', 'music'],
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
    <p className={cn('inline-flex w-fit items-center gap-2 rounded-sm border border-border-soft bg-surface-2 px-3 py-2 text-[9px] font-bold tracking-[0.04em] text-accent', className)}>
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
