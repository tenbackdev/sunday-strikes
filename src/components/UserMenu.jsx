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

export default function UserMenu({ session, profile, onOpenSettings }) {
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

  const displayName = profile?.display_name
    || session.user.user_metadata?.full_name
    || session.user.email

  const avatarBg = profile?.avatar_color
    ? profile.avatar_color
    : 'color-mix(in srgb, var(--accent) 15%, transparent)'
  const avatarColor = profile?.avatar_color ? '#fff' : 'var(--accent)'
  const avatarBorder = profile?.avatar_color
    ? `1px solid ${profile.avatar_color}`
    : '1px solid color-mix(in srgb, var(--accent) 30%, transparent)'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all"
        style={{ background: avatarBg, border: avatarBorder, color: avatarColor }}
        aria-label="User menu"
      >
        {getInitials(session)}
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-60 rounded-xl p-2"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          <div className="px-3 py-2">
            <p className="text-xs font-medium" style={{ color: 'var(--sub)' }}>Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{displayName}</p>
            <p className="truncate text-xs" style={{ color: 'var(--sub)' }}>{session.user.email}</p>
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
