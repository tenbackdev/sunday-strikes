import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { AVATAR_COLORS, avatarStyle } from '../lib/avatar'

function getInitials(session) {
  const name = session.user.user_metadata?.full_name || session.user.email || ''
  if (session.user.user_metadata?.full_name) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }
  return (name[0] || '?').toUpperCase()
}

function SectionLabel({ children }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sub)' }}>
      {children}
    </p>
  )
}

function SettingToggle({ offLabel, onLabel, checked, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: checked ? 'var(--sub)' : 'var(--text)',
            transition: 'color .2s',
          }}
        >
          {offLabel}
        </span>
        <button
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          style={{
            position: 'relative',
            width: 40,
            height: 22,
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            background: checked
              ? 'var(--accent)'
              : 'var(--elevated)',
            outline: '1px solid',
            outlineColor: checked
              ? 'color-mix(in srgb, var(--accent) 60%, transparent)'
              : 'var(--border)',
            transition: 'background .2s, outline-color .2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: checked ? 21 : 3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: checked ? 'var(--acc-text)' : 'var(--sub)',
              transition: 'left .2s',
            }}
          />
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: checked ? 'var(--text)' : 'var(--sub)',
            transition: 'color .2s',
          }}
        >
          {onLabel}
        </span>
      </div>
    </div>
  )
}

export default function UserMenu({ session, theme, onThemeChange, cardPreview, onCardPreviewChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })

  const [displayName, setDisplayName] = useState('')
  const [playerLabel, setPlayerLabel] = useState('')
  const [avatarColor, setAvatarColor] = useState(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const btnRef = useRef(null)
  const panelRef = useRef(null)

  // Position panel flush to button's bottom-right
  useEffect(() => {
    if (!open || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }, [open])

  // Load profile on open
  useEffect(() => {
    if (!open) return
    setProfileLoaded(false)
    supabase
      .from('profiles')
      .select('display_name, player_label, avatar_color')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? '')
        setPlayerLabel(data?.player_label ?? '')
        setAvatarColor(data?.avatar_color ?? null)
        setProfileLoaded(true)
      })
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  async function handleSaveProfile() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        player_label: playerLabel.trim().toUpperCase(),
        avatar_color: avatarColor,
      })
      .eq('id', session.user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const profileDirty = profileLoaded && (
    displayName !== (displayName) // always compare against original
  )

  const email = session.user.email

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        right: pos.right,
        width: 288,
        zIndex: 9999,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: 'var(--shadow-float)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Card Preview */}
      <div>
        <SectionLabel>Card Preview</SectionLabel>
        <SettingToggle
          offLabel="Frames"
          onLabel="Summary"
          checked={cardPreview === 'summary'}
          onChange={v => onCardPreviewChange(v ? 'summary' : 'frames')}
        />
      </div>

      {/* Theme */}
      <div>
        <SectionLabel>Theme</SectionLabel>
        <SettingToggle
          offLabel="Classic"
          onLabel="Cosmic"
          checked={theme === 'cosmic'}
          onChange={v => onThemeChange(v ? 'cosmic' : 'classic')}
        />
      </div>

      {/* Profile fields */}
      <div>
        <SectionLabel>Profile</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--sub)' }}>Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your name"
              disabled={!profileLoaded}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors disabled:opacity-50"
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
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-medium" style={{ color: 'var(--sub)' }}>Player label</label>
            <input
              type="text"
              value={playerLabel}
              onChange={e => setPlayerLabel(e.target.value.toUpperCase())}
              placeholder="A"
              maxLength={3}
              disabled={!profileLoaded}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono uppercase outline-none transition-colors disabled:opacity-50"
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
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium" style={{ color: 'var(--sub)' }}>Avatar color</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATAR_COLORS.map(c => {
                const selected = avatarColor === c
                return (
                  <button
                    key={c}
                    onClick={() => setAvatarColor(c)}
                    title={c}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      border: 'none',
                      cursor: 'pointer',
                      outline: selected ? `2px solid ${c}` : '2px solid transparent',
                      outlineOffset: 2,
                      boxShadow: selected ? `0 0 0 1px var(--card)` : 'none',
                      transition: 'outline .15s, transform .15s',
                      transform: selected ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 0 }} />

      {/* Footer: Save + Sign out side by side, email below */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleSaveProfile}
            disabled={saving || !profileLoaded}
            className="flex-1 rounded-lg py-2 text-xs font-semibold transition-all disabled:opacity-50"
            style={{
              background: saved
                ? 'color-mix(in srgb, var(--win) 15%, transparent)'
                : 'color-mix(in srgb, var(--accent) 15%, transparent)',
              border: saved
                ? '1px solid color-mix(in srgb, var(--win) 30%, transparent)'
                : '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
              color: saved ? 'var(--win)' : 'var(--accent)',
            }}
          >
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
          </button>
          <button
            onClick={() => { setOpen(false); onOpenSettings() }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--text) 6%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Account Settings
          </button>
          <hr className="my-1.5" style={{ borderColor: 'var(--border)' }} />
          <button
            onClick={() => { supabase.auth.signOut(); setOpen(false) }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors"
            style={{ color: 'var(--loss)', border: '1px solid color-mix(in srgb, var(--loss) 25%, transparent)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--loss) 8%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
        <p className="truncate text-center text-[10px]" style={{ color: 'var(--sub)' }}>{email}</p>
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all"
        style={{
          ...avatarStyle(avatarColor),
          border: `1px solid ${avatarColor ? avatarColor + '50' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
        }}
        aria-label="Settings"
      >
        {getInitials(session)}
      </button>

      {open && createPortal(panel, document.body)}
    </>
  )
}
