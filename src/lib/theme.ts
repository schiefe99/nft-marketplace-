import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

const KEY = 'kurio-theme'
const THEME_COLOR = { dark: '#140d0a', light: '#fbf6ef' } as const
const listeners = new Set<() => void>()

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // sem storage (aba privada): o tema vale só para esta visita
  }
  listeners.forEach((l) => l())
}

/**
 * Troca o tema com um círculo que se expande a partir do botão (View Transitions).
 * Sem suporte ou com "reduzir movimento", troca direto.
 */
export function setTheme(theme: Theme, origin?: { x: number; y: number }) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce || !origin) return apply(theme)
  const root = document.documentElement
  root.classList.add('theme-switching')
  const transition = document.startViewTransition(() => apply(theme))
  void transition.ready.then(() => {
    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
    root.animate(
      { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
      { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
    )
  })
  void transition.finished.finally(() => root.classList.remove('theme-switching'))
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    current,
  )
  return { theme, setTheme }
}
