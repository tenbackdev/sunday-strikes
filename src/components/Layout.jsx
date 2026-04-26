import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import MyGames, { UploadModal } from './MyGames'
import FindFriends from './FindFriends'
import VSMatches from './VSMatches'
import VSSubmitModal from './VSSubmitModal'
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
  const [uploadStep, setUploadStep] = useState(null) // null | 'choose' | 'single' | 'vs'
  const [refreshKey, setRefreshKey] = useState(0)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    loadVsUnreadCount()
    loadProfile()
  }, [])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('player_label')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
  }

  function openUpload() { setUploadStep('choose') }
  function closeUpload() { setUploadStep(null) }

  function handleGameSaved() {
    setUploadStep(null)
    setActivePage('my-games')
    setRefreshKey(k => k + 1)
  }

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
        <div className="px-3 pt-3">
          <button
            onClick={openUpload}
            className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Upload Game
          </button>
        </div>
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
            <div className="px-3 pt-3">
              <button
                onClick={() => { setMobileOpen(false); openUpload() }}
                className="flex w-full items-center gap-2 rounded-lg bg-white/10 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Upload Game
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

      {/* FAB — mobile only */}
      <button
        onClick={openUpload}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg hover:bg-slate-700 transition-colors md:hidden"
        aria-label="Upload game"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </button>

      {/* Page content */}
      <main className="pt-14 md:ml-64">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          {activePage === 'my-games' && (
            <MyGames session={session} refreshKey={refreshKey} onOpenUpload={openUpload} />
          )}
          {activePage === 'find-friends' && <FindFriends session={session} />}
          {activePage === 'vs-matches' && <VSMatches session={session} />}
        </div>
      </main>

      {/* Type chooser */}
      {uploadStep === 'choose' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Upload New Game</h3>
              <button onClick={closeUpload} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setUploadStep('single')}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-6 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-8 w-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">Single Game</p>
                  <p className="mt-0.5 text-xs text-gray-400">Just you</p>
                </div>
              </button>
              <button
                onClick={() => setUploadStep('vs')}
                className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-6 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <svg className="h-8 w-8 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-900">VS Match</p>
                  <p className="mt-0.5 text-xs text-gray-400">Head-to-head</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadStep === 'single' && (
        <UploadModal
          session={session}
          profile={profile}
          onClose={closeUpload}
          onSaved={handleGameSaved}
        />
      )}

      {uploadStep === 'vs' && (
        <VSSubmitModal
          session={session}
          onClose={closeUpload}
          onSaved={handleGameSaved}
        />
      )}
    </div>
  )
}
