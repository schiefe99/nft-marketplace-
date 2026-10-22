import { Link } from '@tanstack/react-router'
import { container } from '@/components/layout'
import { buttonVariants } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <div className={container}>
      <section className="mx-auto mt-20 flex max-w-lg flex-col items-center gap-5 text-center" aria-labelledby="nf-title">
        <p className="text-6xl font-bold text-accent" aria-hidden="true">404</p>
        <h1 id="nf-title" className="text-2xl font-bold">Página não encontrada</h1>
        <p className="text-muted">O endereço acessado não existe ou foi removido.</p>
        <Link to="/" className={buttonVariants({ size: 'md' })}>Voltar ao início</Link>
      </section>
    </div>
  )
}
