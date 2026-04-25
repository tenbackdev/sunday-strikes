import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function getInitials(session) {
  const name = session.user.user_metadata?.full_name || session.user.email || ''
  if (session.user.user_metadata?.full_name) {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }
  return (name[0] || '?').toUpperCase()
}

export default function UserMenu({ session }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayName = session.user.user_metadata?.full_name || session.user.email

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-white hover:bg-slate-600 transition-colors"
        aria-label="User menu"
      >
        {getInitials(session)}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-xs font-medium text-gray-400">Signed in as</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-gray-800">{displayName}</p>
          </div>
          <hr className="my-1.5 border-gray-100" />
          <button
            onClick={() => { supabase.auth.signOut(); setOpen(false) }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
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
