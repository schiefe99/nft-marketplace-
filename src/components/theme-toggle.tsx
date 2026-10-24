import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

/** Alterna claro/escuro; o novo tema se espalha em círculo a partir do botão. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        setTheme(next, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
      }}
      aria-label={theme === 'dark' ? 'Mudar para o modo claro' : 'Mudar para o modo escuro'}
      data-testid="theme-toggle"
      className={cn('group inline-flex size-10 items-center justify-center rounded-md transition-colors hover:bg-foreground/5', className)}
    >
      {theme === 'dark' ? (
        <Sun className="size-5 transition-transform duration-500 group-hover:rotate-90" aria-hidden="true" />
      ) : (
        <Moon className="size-5 transition-transform duration-500 group-hover:-rotate-12" aria-hidden="true" />
      )}
    </button>
  )
}
