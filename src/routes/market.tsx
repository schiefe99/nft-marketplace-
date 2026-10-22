import { Breadcrumb, container } from '@/components/layout'
import { CatalogSection } from '@/features/catalog/catalog-section'

export function MarketPage() {
  return (
    <div className={container}>
      <div className="mt-8 mb-6">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado' }]} />
      </div>
      <CatalogSection heading="Mercado" />
    </div>
  )
}
