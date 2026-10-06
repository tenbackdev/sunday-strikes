import { useState, useEffect } from 'react'

// Subscribes to a CSS media query and re-renders when it flips.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// Matches Tailwind's `lg` breakpoint. Desktop-only stats cards are conditionally rendered
// (not CSS-hidden) so mobile never mounts them or measures a 0-width ResponsiveContainer.
export function useIsDesktop() {
  return useMediaQuery('(min-width: 1024px)')
}
