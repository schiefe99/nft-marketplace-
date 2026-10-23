import { useSyncExternalStore } from 'react'

/** Breakpoint dos frames "Mobile / *" do Figma (abaixo do `md` do Tailwind). */
const MOBILE_QUERY = '(max-width: 767.98px)'

function subscribe(query: string) {
  return (onChange: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(subscribe(query), () => window.matchMedia(query).matches, () => false)
}

/**
 * Renderização condicional por layout (não apenas CSS): evita controles
 * duplicados com o mesmo rótulo acessível em mobile e desktop.
 */
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY)
