export const AMBER = '#BE7C2A'

// Below this sample size, a rate/percentage line is too noisy to trend — charts should
// drop the point (leaving a gap) rather than plot a rate off a handful of data points.
// Applies wherever a chart plots a rate per bucket or per rolling window across the
// personal Stats and VS Stats pages.
export const MIN_TREND_SAMPLE = 10

// Bucket widths a user can choose in Account Settings (profiles.score_bucket_size).
export const DEFAULT_BUCKET_SIZE = 20
export const BUCKET_SIZES = [10, 20]

export function normalizeBucketSize(size) {
  return BUCKET_SIZES.includes(size) ? size : DEFAULT_BUCKET_SIZE
}

// Fixed score buckets (10- or 20-pt wide) — always the same set regardless of data, per the
// "score distribution buckets must be pre-defined and complete" rule (300 gets its own bucket).
// Labels are each bucket's lower bound; the 100–299 span is always fully covered.
export function getScoreBuckets(size = DEFAULT_BUCKET_SIZE) {
  const width = normalizeBucketSize(size)
  return [
    { label: '< 100', test: s => s < 100, isPerfect: false },
    ...Array.from({ length: 200 / width }, (_, i) => {
      const lo = 100 + i * width
      return { label: String(lo), test: s => s >= lo && s < lo + width, isPerfect: false }
    }),
    { label: '300', test: s => s === 300, isPerfect: true },
  ]
}

// X-axis props for a bucket-labelled chart; 10-pt buckets (22 labels) need angled ticks to fit.
export function bucketAxisProps(size) {
  return normalizeBucketSize(size) === 10
    ? { angle: -45, textAnchor: 'end', height: 36 }
    : {}
}

export function getChartColors() {
  const s = getComputedStyle(document.documentElement)
  return {
    accent: s.getPropertyValue('--accent').trim() || '#CE1B0E',
    sub:    s.getPropertyValue('--sub').trim()    || '#9E8B6E',
    border: s.getPropertyValue('--border').trim() || '#DECCA2',
    text:   s.getPropertyValue('--text').trim()   || '#2C1810',
    win:    s.getPropertyValue('--win').trim()    || '#1A6B2E',
    loss:   s.getPropertyValue('--loss').trim()   || '#B91C1C',
    third:  '#4A7FA5',
  }
}

export function toLocalDateStr(isoStr) {
  const d = new Date(isoStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
