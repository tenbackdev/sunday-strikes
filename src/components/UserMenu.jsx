import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getInitials(session) {
  const name = session.user.user_metadata?.full_name || session.user.email || ''
  if (session.user.user_metadata?.full_name) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }
  return (name[0] || '?').toUpperCase()
}

export default function UserMenu({ session, profile, onOpenSettings }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
          <hr className="my-1.5" style={{ borderColor: 'var(--border)' }} />
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--loss)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--loss) 8%, transparent)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
