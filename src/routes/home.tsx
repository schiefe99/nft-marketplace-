import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
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

  return (
    <section
      aria-labelledby="hero-title"
      aria-roledescription="carrossel"
      className="relative mt-4 md:mt-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-2.5 overflow-hidden rounded-[14px] bg-surface p-3.5 md:grid-cols-[1fr_450px] md:gap-10 md:rounded-none md:bg-transparent md:p-0">
        {/* textos do frame "Mobile / Início" no celular e do frame "Início" no desktop */}
        <div className="order-1 flex flex-col gap-2 md:gap-6 md:pl-10">
          <p className="text-[10px] md:text-[15px] md:tracking-[0.1em]">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-sm font-bold leading-5 tracking-[0.04em] md:text-[43px] md:leading-[70px]">
            <span className="md:hidden">SEJA DONO DA CULTURA DIGITAL</span>
            <span className="max-md:hidden">SEJA DONO DO FUTURO <br />DA ARTE DIGITAL</span>
          </h1>
          <p className="max-w-[560px] text-[11px] leading-4 text-muted md:text-sm md:leading-6">
            <span className="md:hidden">Descubra NFTs selecionados de criadores do mundo todo.</span>
            <span className="max-md:hidden">Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.</span>
          </p>
          <a href="#catalogo" className="w-fit text-[11px] font-bold text-accent md:hidden">
            EXPLORAR <ArrowRight className="inline size-3" aria-hidden="true" />
          </a>
          <a href="#catalogo" className={cn(buttonVariants({ size: 'md' }), 'w-fit self-center px-7 text-[15px] tracking-[0.04em] max-md:hidden')}>
            EXPLORAR
          </a>
        </div>
        <div className="order-2 justify-self-end">
          {/* todas as imagens ficam empilhadas (já carregadas) e a atual aparece com fade */}
          <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`} className="relative block">
            {slides.map((s, i) => (
              <img
                key={s.id}
                src={s.imageUrl}
                alt={i === index ? `Destaque: ${s.name}` : ''}
                aria-hidden={i !== index}
                width={450}
                height={450}
                fetchPriority={i === 0 ? 'high' : 'low'}
                className={cn(
                  'aspect-square w-32 rounded-xl object-cover transition-opacity duration-300 sm:w-[220px] md:w-[450px] md:rounded-[24px]',
                  i > 0 && 'absolute inset-0',
                  i === index ? 'opacity-100' : 'opacity-0',
                )}
              />
            ))}
          </Link>
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

const PROMOS = [
  { title: 'Lançamentos gênesis de edição limitada', text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.', image: '/nfts/glasses-a.webp', search: { tab: 'new' as const } },
  { title: 'Arte digital selecionada e muito mais', text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.', image: '/nfts/black-a.webp', search: {} },
]

function Promos() {
  return (
    <section aria-label="Campanhas" className="mt-24 hidden gap-8 md:grid md:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,287px)_1fr] gap-4 overflow-hidden rounded-sm bg-surface p-4">
          <img src={p.image} alt="" width={287} height={250} loading="lazy" className="h-full max-h-[250px] w-full rounded-md object-cover" />
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
      <div className="text-center">
        <h2 id="blog-title" className="text-2xl font-bold md:text-[30px]">Diário da Cunhagem</h2>
        <p className="mt-3 text-sm text-muted">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      </div>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((p) => (
          <li key={p.title}>
            <article className="h-full overflow-hidden rounded-sm bg-surface">
              <img src={p.image} alt="" width={268} height={195} loading="lazy" className="aspect-[268/195] w-full object-cover" />
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
      <div className="mt-5 md:mt-24">
        <CatalogSection />
      </div>
      <Promos />
      <Blog />
    </div>
  )
}
