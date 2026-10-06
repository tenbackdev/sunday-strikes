import { OIL_TYPES } from '../lib/oilType'

// Pill-style segmented control matching the app's time-filter rows.
export default function OilToggle({ value, onChange, options = OIL_TYPES, size = 'md', ariaLabel = 'Oil type' }) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'flex-1 py-1.5 text-xs'
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-xl p-1"
      style={{ background: 'var(--elevated)', border: '1px solid var(--border)' }}
    >
      {options.map(o => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.key)}
            className={`${pad} rounded-lg font-medium transition-opacity hover:opacity-80 active:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-1`}
            style={active ? {
              background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
              color: 'var(--accent)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              outlineColor: 'var(--accent)',
            } : { color: 'var(--sub)', border: '1px solid transparent', outlineColor: 'var(--accent)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
