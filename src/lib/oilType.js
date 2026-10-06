// Oil type (house vs sport) — shared filter helpers.

export const OIL_TYPES = [
  { key: 'house', label: 'House' },
  { key: 'sport', label: 'Sport' },
]

export const OIL_FILTERS = [{ key: 'all', label: 'All' }, ...OIL_TYPES]

const FILTER_KEY = 'ss_oil_filter'

export function loadOilFilter() {
  try {
    const v = localStorage.getItem(FILTER_KEY)
    return OIL_FILTERS.some(f => f.key === v) ? v : 'all'
  } catch {
    return 'all'
  }
}

export function saveOilFilter(value) {
  try { localStorage.setItem(FILTER_KEY, value) } catch { /* storage unavailable */ }
}

// Narrow a Supabase `games` query to the active oil filter.
export function applyOilFilter(query, oilFilter) {
  return oilFilter && oilFilter !== 'all' ? query.eq('oil_type', oilFilter) : query
}

// Client-side equivalent for already-loaded games. Missing oil_type counts as house.
export function matchesOil(game, oilFilter) {
  if (!oilFilter || oilFilter === 'all') return true
  return (game?.oil_type ?? 'house') === oilFilter
}

export function oilLabel(oilFilter) {
  return OIL_FILTERS.find(f => f.key === oilFilter)?.label ?? ''
}
