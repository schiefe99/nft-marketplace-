import { AlertTriangle, SearchX } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { isApiError } from '@/api/client'

export function ErrorState({ error, onRetry, title = 'Algo deu errado' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = isApiError(error) ? error.message : 'Erro inesperado. Tente novamente.'
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-md border border-border bg-surface px-6 py-12 text-center" data-testid="error-state">
      <AlertTriangle className="size-10 text-warning" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {onRetry && (
        <Button size="md" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-border-soft px-6 py-12 text-center" data-testid="empty-state">
      <SearchX className="size-10 text-caption" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}
