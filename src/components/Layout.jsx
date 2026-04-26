import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import MyGames from './MyGames'
import FindFriends from './FindFriends'
import VSMatches from './VSMatches'
import UserMenu from './UserMenu'

const NAV_ITEMS = [
  {
    id: 'my-games',
    label: 'My Games',
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3"/>
        <line x1="12" y1="2" x2="12" y2="5"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="5" y2="12"/>
        <line x1="19" y1="12" x2="22" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'vs-matches',
    label: 'VS',
    hasBadge: true,
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
  {
    id: 'find-friends',
    label: 'Friends',
    icon: (
      <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
]

function SidebarNav({ activePage, onNavClick, vsUnreadCount }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-3">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => onNavClick(item.id)}
          className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left
            ${activePage === item.id
              ? 'bg-white/15 text-white'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
        >
          <span className="relative">
            {item.icon}
            {item.hasBadge && vsUnreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                {vsUnreadCount > 9 ? '9+' : vsUnreadCount}
              </span>
            )}
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}


function SidebarHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
      <img src="/SundayStrikesLogo192.png" alt="Sunday Strikes" className="h-8 w-8 rounded-lg" />
      <span className="text-base font-bold text-white">Sunday Strikes</span>
    </div>
  )
}

export default function Layout({ session }) {
  const [activePage, setActivePage] = useState('my-games')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [vsUnreadCount, setVsUnreadCount] = useState(0)

  useEffect(() => {
    loadVsUnreadCount()
  }, [])

  async function loadVsUnreadCount() {
    const { count } = await supabase
      .from('vs_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .is('read_at', null)
    setVsUnreadCount(count ?? 0)
  }

  async function handleNavClick(id) {
    setActivePage(id)
    setMobileOpen(false)
    if (id === 'vs-matches' && vsUnreadCount > 0) {
      setVsUnreadCount(0)
      await supabase
        .from('vs_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .is('read_at', null)
    }
  }

  const currentLabel = NAV_ITEMS.find(i => i.id === activePage)?.label ?? 'Sunday Strikes'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 md:flex">
        <SidebarHeader />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav activePage={activePage} onNavClick={handleNavClick} vsUnreadCount={vsUnreadCount} />
        </div>
      </aside>

      {/* Mobile sidebar — slide-in overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <img src="/SundayStrikesLogo192.png" alt="Sunday Strikes" className="h-8 w-8 rounded-lg" />
                <span className="text-base font-bold text-white">Sunday Strikes</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav activePage={activePage} onNavClick={handleNavClick} vsUnreadCount={vsUnreadCount} />
            </div>
          </aside>
        </div>
      )}

      {/* Top header bar */}
      <header className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-gray-100 bg-white px-4 md:left-64">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors md:hidden"
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Page title — mobile center, with VS badge */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="text-sm font-semibold text-gray-700">{currentLabel}</span>
          {activePage === 'vs-matches' && vsUnreadCount > 0 && (
            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
              {vsUnreadCount}
            </span>
          )}
        </div>

        {/* Desktop spacer */}
        <div className="hidden md:block" />

        <UserMenu session={session} />
      </header>

      {/* Page content */}
      <main className="pt-14 md:ml-64">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          {activePage === 'my-games' && <MyGames session={session} />}
          {activePage === 'find-friends' && <FindFriends session={session} />}
          {activePage === 'vs-matches' && <VSMatches session={session} />}
        </div>
      </main>
    </div>
  )
}
