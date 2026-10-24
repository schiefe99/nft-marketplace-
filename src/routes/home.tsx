import { Link } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, Check, Clock, ShieldCheck, Sparkles, Wallet } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { container } from '@/components/layout'
import { buttonVariants } from '@/components/ui/button'
import { CatalogSection } from '@/features/catalog/catalog-section'
import { useCatalogMeta } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'
import { useMediaQuery } from '@/lib/use-media'

const HERO_FALLBACK = '/nfts/glasses-a.webp'
const HERO_INTERVAL_MS = 1000

function Hero() {
  const meta = useCatalogMeta()
  const featured = meta.data?.featured ?? []
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // primeiro slide é estático (LCP previsível); demais vêm da API
  const slides = [{ id: 'nft-001', name: 'Emerald Ape #042', imageUrl: HERO_FALLBACK }, ...featured.filter((f) => f.id !== 'nft-001')].slice(0, 3)
  const current = slides[index] ?? slides[0]

  // Troca automática a cada 1 s; pausa com mouse/foco no destaque e respeita "reduzir movimento"
  const autoplay = slides.length > 1 && !paused && !reducedMotion
  useEffect(() => {
    if (!autoplay) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), HERO_INTERVAL_MS)
    return () => clearInterval(t)
  }, [autoplay, slides.length])

  // inclinação 3D que segue o mouse (só desktop): variáveis CSS no próprio elemento, sem re-render
  const tilt = (e: MouseEvent<HTMLDivElement>) => {
    if (reducedMotion) return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--rx', `${(-((e.clientY - r.top) / r.height - 0.5) * 8).toFixed(2)}deg`)
    e.currentTarget.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width - 0.5) * 10).toFixed(2)}deg`)
  }
  const untilt = (e: MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }
  const other = slides[(index + 1) % slides.length]

  return (
    <section
      aria-labelledby="hero-title"
      aria-roledescription="carrossel"
      className="relative mt-4 md:mt-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      <HeroBackdrop />
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-2.5 overflow-hidden rounded-[14px] bg-surface p-3.5 md:grid-cols-[1fr_440px] md:gap-12 md:overflow-visible md:rounded-none md:bg-transparent md:px-0 md:pb-20 md:pt-16">
        {/* textos do frame "Mobile / Início" no celular e do frame "Início" no desktop */}
        <div className="order-1 flex flex-col gap-2 md:gap-7 md:pl-10">
          <p className="flex items-center gap-2 text-[10px] md:text-[13px] md:font-bold md:tracking-[0.24em] md:text-accent">
            <span aria-hidden="true" className="hidden size-2 animate-live rounded-full bg-accent md:block" />
            <span className="md:hidden">Bem-vindo à Kurio</span>
            <span className="max-md:hidden">BEM-VINDO À KURIO</span>
          </p>
          <h1 id="hero-title" className="text-sm font-bold leading-5 tracking-[0.04em] md:text-[52px] md:leading-[1.08] md:tracking-[-0.02em]">
            <span className="md:hidden">SEJA DONO DA CULTURA DIGITAL</span>
            <span className="max-md:hidden">
              SEJA DONO DO FUTURO <br />
              DA <span className="text-gradient">ARTE DIGITAL</span>
            </span>
          </h1>
          <p className="max-w-[560px] text-[11px] leading-4 text-muted md:text-base md:leading-7">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="max-md:hidden">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</span>
          </p>
          <a href="#catalogo" className="w-fit text-[11px] font-bold text-accent md:hidden">
            EXPLORAR <ArrowRight className="inline size-3" aria-hidden="true" />
          </a>
          <div className="flex flex-wrap gap-3 max-md:hidden">
            <a href="#catalogo" className={cn(buttonVariants({ size: 'md' }), 'w-fit px-7 text-[15px]')}>
              EXPLORAR <ArrowRight aria-hidden="true" />
            </a>
            <a href="#como-comprar" className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'w-fit px-7 text-[15px]')}>
              Como comprar
            </a>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted max-md:hidden">
            {['Pagamento protegido', 'Edições verificadas', 'Ethereum, Polygon e Solana'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-accent" aria-hidden="true" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div
          className="order-2 justify-self-end [perspective:1200px] md:relative md:justify-self-center"
          onMouseMove={tilt}
          onMouseLeave={untilt}
        >
          {/* card de trás: o próximo destaque, inclinado e flutuando em outro ritmo */}
          {other && other.id !== current.id && (
            <div aria-hidden="true" className="absolute -left-24 top-16 hidden w-48 -rotate-[9deg] animate-float-slow overflow-hidden rounded-[20px] border border-border-soft bg-surface shadow-[0_30px_60px_-24px_rgb(0_0_0/0.6)] md:block">
              <img src={other.imageUrl} alt="" width={192} height={192} loading="lazy" className="aspect-square w-full object-cover" />
              <p className="truncate px-3 py-2.5 text-xs font-bold">{other.name}</p>
            </div>
          )}
          <div className="transition-transform duration-300 ease-out [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] md:animate-float">
            <div className="md:rounded-[28px] md:border md:border-border-soft md:bg-linear-to-br md:from-surface-2 md:to-surface md:p-4 md:shadow-[0_40px_90px_-30px_rgb(0_0_0/0.7)]">
              <p className="mb-3 hidden items-center justify-between text-xs font-bold tracking-[0.08em] text-accent md:flex">
                <span className="flex items-center gap-2">
                  <span aria-hidden="true" className="size-2 animate-live rounded-full bg-accent" /> EM DESTAQUE
                </span>
                <span className="text-muted">{index + 1}/{slides.length}</span>
              </p>
              {/* todas as imagens ficam empilhadas (já carregadas) e a atual aparece com fade */}
              <Link
                to="/nft/$nftId"
                params={{ nftId: current.id }}
                aria-label={`Ver ${current.name}`}
                className="relative block overflow-hidden rounded-xl md:rounded-[20px] md:before:absolute md:before:inset-y-0 md:before:left-0 md:before:z-10 md:before:w-[45%] md:before:animate-offer-shine md:before:bg-linear-to-r md:before:from-transparent md:before:via-white/25 md:before:to-transparent"
              >
                {slides.map((s, i) => (
                  <img
                    key={s.id}
                    src={s.imageUrl}
                    alt={i === index ? `Destaque: ${s.name}` : ''}
                    aria-hidden={i !== index}
                    width={410}
                    height={410}
                    fetchPriority={i === 0 ? 'high' : 'low'}
                    // a nova entra por cima e a anterior só some depois: a troca nunca mostra o fundo do card
                    className={cn(
                      'aspect-square w-32 object-cover transition-opacity duration-300 sm:w-[220px] md:w-[406px]',
                      i > 0 ? 'absolute inset-0' : 'relative',
                      i === index ? 'z-[1] opacity-100' : 'opacity-0 delay-300',
                    )}
                  />
                ))}
              </Link>
              <p className="mt-4 hidden items-center justify-between gap-4 md:flex">
                <span className="truncate text-lg font-bold">{current.name}</span>
                <Link to="/nft/$nftId" params={{ nftId: current.id }} className="group/more flex shrink-0 items-center gap-1.5 text-sm font-bold text-accent" tabIndex={-1} aria-hidden="true">
                  Ver NFT <ArrowRight className="size-4 transition-transform group-hover/more:translate-x-1" />
                </Link>
              </p>
            </div>
          </div>
        </div>
        {slides.length > 1 && (
          // fora da área da imagem: o fade entre slides nunca cobre o indicador
          <div className="order-3 hidden justify-center gap-2 md:col-start-2 md:-mt-4 md:flex" role="group" aria-label="Destaques">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Mostrar destaque ${i + 1}: ${s.name}`}
                aria-current={i === index}
                className={cn('size-2.5 rounded-full border border-primary', i === index ? 'bg-primary' : 'bg-primary/40')}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Fundo do hero no desktop: brilho radial e faixas em SVG que ondulam devagar (decorativo). */
function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-screen -translate-x-1/2 overflow-hidden md:block">
      <div className="absolute right-[8%] top-[10%] size-[560px] rounded-full bg-primary/15 blur-[90px]" />
      <div className="absolute -left-40 bottom-0 size-[420px] rounded-full bg-primary/10 blur-[90px]" />
      <svg viewBox="0 0 1440 700" preserveAspectRatio="none" className="absolute inset-0 size-full">
        <path d="M-40 560 C 260 400, 520 700, 820 500 S 1300 240, 1500 360" className="fill-none stroke-primary/45 [animation:drift_14s_ease-in-out_infinite_alternate,dash_30s_linear_infinite] [stroke-dasharray:8_16] [stroke-width:2]" />
        <path d="M-60 640 C 300 500, 620 760, 940 580 S 1360 360, 1520 460" className="animate-drift-reverse fill-none stroke-accent/15 [stroke-width:70]" />
        <path d="M-40 160 C 300 280, 600 40, 900 180 S 1300 80, 1500 220" className="animate-drift fill-none stroke-border-soft [stroke-dasharray:2_10] [stroke-width:2]" />
      </svg>
    </div>
  )
}

/** Faixa de coleções rolando sem parar; pausa no hover. Decorativa: as coleções também estão nos filtros. */
function CollectionsMarquee() {
  const meta = useCatalogMeta()
  const names = meta.data?.collections ?? []
  if (!names.length) return null
  return (
    <div aria-hidden="true" className="group/marquee relative left-1/2 mt-6 w-screen -translate-x-1/2 overflow-hidden border-y border-border bg-surface/60 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)] md:mt-0">
      <div className="flex w-max animate-marquee group-hover/marquee:[animation-play-state:paused]">
        {[...names, ...names].map((n, i) => (
          <span key={i} className="flex items-center gap-4 whitespace-nowrap px-6 py-4 text-sm font-bold tracking-[0.06em] text-muted md:py-5 md:text-[15px]">
            <Sparkles className="size-3.5 text-primary" />
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

const STEPS = [
  { icon: Wallet, title: 'Carteira conectada', text: 'MetaMask, WalletConnect ou Coinbase' },
  { icon: Clock, title: 'Cotação travada', text: 'O preço fica garantido durante o pagamento' },
  { icon: ShieldCheck, title: 'Pagamento confirmado', text: 'Sem cobrança dupla, mesmo se a conexão cair' },
  { icon: BadgeCheck, title: 'NFT na sua carteira', text: 'Recibo com rede, carteira e transação' },
]

/** "Como comprar": as etapas acendem em sequência, em loop, como um pedido acontecendo. */
function HowToBuy() {
  return (
    <section id="como-comprar" aria-labelledby="como-title" className="mt-24 hidden scroll-mt-28 items-center gap-20 md:grid md:grid-cols-2">
      <div className="reveal">
        <p className="text-xs font-bold tracking-[0.32em] text-accent">COMO COMPRAR</p>
        <h2 id="como-title" className="mt-4 text-[40px] font-bold leading-[1.1] tracking-[-0.02em]">
          Do clique à carteira em <span className="text-gradient">quatro passos</span>
        </h2>
        <p className="mt-5 max-w-md leading-7 text-muted">Você acompanha cada etapa da compra em tempo real, do carrinho até o NFT chegar na sua carteira.</p>
        <Link to="/mercado" className={cn(buttonVariants({ size: 'md' }), 'mt-8 w-fit px-7')}>
          Começar agora <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <div className="reveal rounded-[26px] border border-border bg-linear-to-br from-surface-2 to-surface p-7 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.7)]">
        <p className="mb-5 flex items-center justify-between text-sm font-bold">
          Seu pedido
          <span className="flex items-center gap-2 text-xs tracking-[0.08em] text-accent">
            <span aria-hidden="true" className="size-2 animate-live rounded-full bg-accent" /> AO VIVO
          </span>
        </p>
        <ol className="relative grid gap-2.5 before:absolute before:bottom-[18px] before:left-[17px] before:top-[18px] before:w-0.5 before:bg-border">
          <li aria-hidden="true" className="absolute left-[17px] top-[18px] w-0.5 animate-step-line bg-primary" />
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="relative flex animate-step items-center gap-4 rounded-[14px] border border-transparent py-3 pr-3"
              style={{ animationDelay: `${i * 1.2}s` }}
            >
              <span
                className="relative z-10 grid size-9 shrink-0 animate-step-icon place-items-center rounded-full border border-border-soft bg-surface text-caption"
                style={{ animationDelay: `${i * 1.2}s` }}
              >
                <s.icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold">{s.title}</span>
                <span className="block text-xs text-caption">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

const PROMOS = [
  { title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', image: '/nfts/glasses-a.webp', search: { tab: 'new' as const } },
  { title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', image: '/nfts/black-a.webp', search: {} },
]

function Promos() {
  return (
    <section aria-label="Campanhas" className="mt-24 hidden gap-8 md:grid md:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title} className="reveal group grid grid-cols-[minmax(0,287px)_1fr] gap-4 overflow-hidden rounded-sm border border-transparent bg-surface p-4 transition-[border-color,box-shadow] duration-300 hover:border-border-soft hover:shadow-[0_24px_50px_-28px_rgb(0_0_0/0.6)]">
          <div className="overflow-hidden rounded-md">
            <img src={p.image} alt="" width={287} height={250} loading="lazy" className="h-full max-h-[250px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          </div>
          <div className="flex flex-col items-end justify-center gap-4 p-4 text-right">
            <h2 className="text-base font-bold leading-6 md:text-[17px]">{p.title}</h2>
            <p className="text-[13px] leading-6 text-muted md:text-sm">{p.text}</p>
            <Link to="/mercado" search={p.search} className={cn(buttonVariants({ size: 'sm' }), 'h-10 rounded-[4px] px-[26px] text-sm')} aria-label={`Explorar: ${p.title}`}>
              Explorar <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </article>
      ))}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: '6', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/nfts/black-a.webp' },
  { date: '13 de setembro', read: '2', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/nfts/glasses-a.webp' },
  { date: '15 de setembro', read: '3', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/nfts/bucket-a.webp' },
  { date: '15 de setembro', read: '2', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/nfts/orange-a.webp' },
]

function Blog() {
  return (
    <section aria-labelledby="blog-title" className="mt-24 hidden md:block">
      <div className="reveal text-center">
        <h2 id="blog-title" className="text-2xl font-bold md:text-[30px]">Diário da Cunhagem</h2>
        <p className="mt-3 text-sm text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title} className="reveal">
            <article className="group relative h-full overflow-hidden rounded-sm bg-surface transition-transform duration-300 after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:origin-left after:scale-x-0 after:bg-linear-to-r after:from-primary after:to-accent after:transition-transform after:duration-300 hover:-translate-y-1.5 hover:after:scale-x-100">
              <div className="overflow-hidden">
                <img src={p.image} alt="" width={268} height={195} loading="lazy" className="aspect-[268/195] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="flex flex-col gap-2 p-4">
                <p className="text-xs text-muted">{p.date} <span aria-hidden="true">|</span> Leitura de {p.read} min</p>
                <h3 className="text-base font-bold leading-[21px]">{p.title}</h3>
                <p className="text-xs leading-4 text-muted">{p.text}</p>
                <span aria-disabled="true" className="cursor-not-allowed text-xs font-bold text-accent" title="Em breve">
                  Ler mais <span aria-hidden="true">→</span><span className="sr-only"> (artigo em breve)</span>
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function HomePage() {
  return (
    <div className={container}>
      <Hero />
      <CollectionsMarquee />
      <div className="mt-5 md:mt-24">
        <CatalogSection />
      </div>
      <HowToBuy />
      <Promos />
      <Blog />
    </div>
  )
}
