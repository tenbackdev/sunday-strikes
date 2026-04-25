import { useState } from 'react'
import { supabase } from '../lib/supabase'
import MyGames from './MyGames'
import FindFriends from './FindFriends'
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
    id: 'find-friends',
    label: 'Find Friends',
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

function SidebarNav({ activePage, setActivePage, onNavClick }) {
  return (
    <nav className="flex flex-col gap-0.5 px-3 py-3">
      {NAV_ITEMS.map(item => (
        <button
          key={item.id}
          onClick={() => { setActivePage(item.id); onNavClick?.() }}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left
            ${activePage === item.id
              ? 'bg-white/15 text-white'
              : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  )
}

function SidebarFooter() {
  return (
    <div className="border-t border-white/10 px-3 py-3">
      <button
        onClick={() => supabase.auth.signOut()}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
      >
        <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign out
      </button>
    </div>
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

  const currentLabel = NAV_ITEMS.find(i => i.id === activePage)?.label ?? 'Sunday Strikes'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar — always visible at md+ */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-slate-900 md:flex">
        <SidebarHeader />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav activePage={activePage} setActivePage={setActivePage} />
        </div>
        <SidebarFooter />
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
              <SidebarNav activePage={activePage} setActivePage={setActivePage} onNavClick={() => setMobileOpen(false)} />
            </div>
            <SidebarFooter />
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

        {/* Page title — mobile center */}
        <span className="text-sm font-semibold text-gray-700 md:hidden">{currentLabel}</span>

        {/* Desktop spacer */}
        <div className="hidden md:block" />

        <UserMenu session={session} />
      </header>

      {/* Page content */}
      <main className="pt-14 md:ml-64">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          {activePage === 'my-games' && <MyGames session={session} />}
          {activePage === 'find-friends' && <FindFriends session={session} />}
        </div>
      </main>
    </div>
  )
}
