import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { container } from '@/components/layout'
import { buttonVariants } from '@/components/ui/button'
import { CatalogSection } from '@/features/catalog/catalog-section'
import { useCatalogMeta } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'

const HERO_FALLBACK = '/nfts/glasses-a.webp'

function Hero() {
  const meta = useCatalogMeta()
  const featured = meta.data?.featured ?? []
  const [index, setIndex] = useState(0)
  // primeiro slide é estático (LCP previsível); demais vêm da API
  const slides = [{ id: 'nft-001', name: 'Emerald Ape #042', imageUrl: HERO_FALLBACK }, ...featured.filter((f) => f.id !== 'nft-001')].slice(0, 3)
  const current = slides[index] ?? slides[0]

  return (
    <section aria-labelledby="hero-title" className="relative mt-4 md:mt-8">
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-4 overflow-hidden rounded-md bg-surface/60 p-4 md:grid-cols-[1fr_450px] md:gap-10 md:bg-transparent md:p-0">
        <div className="order-1 flex flex-col gap-3 md:gap-6 md:pl-10">
          <p className="text-xs tracking-[0.1em] md:text-[15px]">Bem-vindo à Kurio</p>
          <h1 id="hero-title" className="text-lg font-bold leading-snug tracking-[0.04em] md:text-[43px] md:leading-[70px]">
            SEJA DONO DO FUTURO <br className="hidden md:block" />
            DA ARTE DIGITAL
          </h1>
          <p className="max-w-[560px] text-xs leading-5 text-muted md:text-sm md:leading-6">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <a href="#catalogo" className={cn(buttonVariants({ size: 'md' }), 'w-fit px-7 text-[15px] tracking-[0.04em]')}>
            EXPLORAR <ArrowRight className="md:hidden" aria-hidden="true" />
          </a>
        </div>
        <div className="order-2 justify-self-end">
          <Link to="/nft/$nftId" params={{ nftId: current.id }} aria-label={`Ver ${current.name}`} className="block">
            <img
              src={current.imageUrl}
              alt={`Destaque: ${current.name}`}
              width={450}
              height={450}
              fetchPriority="high"
              className="aspect-square w-[120px] rounded-xl object-cover sm:w-[220px] md:w-[450px]"
            />
          </Link>
        </div>
        {slides.length > 1 && (
          <div className="order-3 col-span-2 flex justify-center gap-2 md:absolute md:bottom-10 md:left-[calc(50%-120px)]" role="group" aria-label="Destaques">
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
    <section aria-label="Campanhas" className="mt-24 grid gap-7 md:grid-cols-2">
      {PROMOS.map((p) => (
        <article key={p.title} className="grid grid-cols-[minmax(0,287px)_1fr] overflow-hidden rounded-sm bg-surface">
          <img src={p.image} alt="" width={287} height={250} loading="lazy" className="h-full max-h-[250px] w-full rounded-r-xl object-cover" />
          <div className="flex flex-col items-end justify-center gap-4 p-4 text-right md:p-7">
            <h2 className="text-base font-bold leading-6">{p.title}</h2>
            <p className="text-[13px] leading-6 text-muted">{p.text}</p>
            <Link to="/mercado" search={p.search} className={cn(buttonVariants({ size: 'sm' }), 'h-10 px-6 text-sm')} aria-label={`Explorar: ${p.title}`}>
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
    <section aria-labelledby="blog-title" className="mt-24">
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
      <div className="mt-16 md:mt-24">
        <CatalogSection />
      </div>
      <Promos />
      <Blog />
    </div>
  )
}
