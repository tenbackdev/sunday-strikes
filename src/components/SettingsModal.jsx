import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { AVATAR_COLORS } from '../lib/avatar'


const THEME_OPTIONS = [
  { value: 'classic', label: '✦ Classic' },
  { value: 'cosmic',  label: '☀ Cosmic' },
]

function ThemedInput(props) {
  return (
    <input
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{
        background: 'var(--elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--accent)'
        e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)'
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--border)'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

function SegmentedButtons({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[0.97]"
          style={{
            background: value === opt.value ? 'var(--accent)' : 'var(--elevated)',
            color: value === opt.value ? 'var(--acc-text)' : 'var(--sub)',
            border: `1px solid ${value === opt.value ? 'var(--accent)' : 'var(--border)'}`,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsModal({ session, profile, theme, navItems, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(
    profile?.display_name || session.user.user_metadata?.full_name || ''
  )
  const [avatarColor, setAvatarColor] = useState(profile?.avatar_color || null)
  const [selectedTheme, setSelectedTheme] = useState(theme)
  const [defaultPage, setDefaultPage] = useState(profile?.default_page || 'my-games')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    const updates = {
      display_name: displayName.trim() || null,
      avatar_color: avatarColor,
      theme_preference: selectedTheme,
      default_page: defaultPage,
    }
    const { error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
    if (err) {
      setError('Failed to save settings. Please try again.')
      setSaving(false)
      return
    }
    onSave({ ...profile, ...updates })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl modal-enter"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2 className="font-display text-xl" style={{ color: 'var(--text)' }}>Account Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: 'var(--sub)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 8%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 overflow-y-auto px-5 py-5" style={{ maxHeight: '70vh' }}>
          {error && (
            <p className="rounded-lg px-3 py-2 text-xs font-medium"
              style={{ background: 'color-mix(in srgb, var(--loss) 12%, transparent)', color: 'var(--loss)' }}>
              {error}
            </p>
          )}

          {/* Profile */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
              Profile
            </p>
            <label className="mb-1.5 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Display name
            </label>
            <ThemedInput
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
            />
          </section>

          {/* Appearance */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
              Appearance
            </p>

            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Avatar color
            </label>
            <div className="mb-5 flex flex-wrap gap-2.5">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(avatarColor === color ? null : color)}
                  title={color}
                  className="h-8 w-8 rounded-full transition-transform active:scale-90"
                  style={{
                    background: color,
                    outline: avatarColor === color
                      ? `3px solid ${color}`
                      : '3px solid transparent',
                    outlineOffset: '2px',
                  }}
                />
              ))}
            </div>

            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Theme
            </label>
            <SegmentedButtons options={THEME_OPTIONS} value={selectedTheme} onChange={setSelectedTheme} />
          </section>

          {/* Preferences */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
              Preferences
            </p>
            <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
              Default page on sign-in
            </label>
            <SegmentedButtons
              options={navItems.map(i => ({ value: i.id, label: i.label }))}
              value={defaultPage}
              onChange={setDefaultPage}
            />
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2 px-5 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--sub)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 8%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-5 py-2 text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--accent)',
              color: 'var(--acc-text)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
