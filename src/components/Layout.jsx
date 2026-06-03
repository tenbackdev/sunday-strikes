import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import MyGames, { UploadModal } from './MyGames'
import FindFriends from './FindFriends'
import VSMatches from './VSMatches'
import VSSubmitModal from './VSSubmitModal'
import UserMenu from './UserMenu'
import SettingsModal from './SettingsModal'

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


function NavItem({ item, isActive, onClick, vsUnreadCount }) {
  return (
    <button
      onClick={() => onClick(item.id)}
      className="relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-left transition-colors"
      style={{
        color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
        background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
        borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
      }}
    >
      <span className="relative">
        {item.icon}
        {item.hasBadge && vsUnreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ background: 'var(--loss)' }}>
            {vsUnreadCount > 9 ? '9+' : vsUnreadCount}
          </span>
        )}
      </span>
      {item.label}
    </button>
  )
}

function SidebarContent({ activePage, onNavClick, vsUnreadCount, onUpload }) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src="/SundayStrikesLogo192.png" alt="Sunday Strikes" className="h-8 w-8 rounded-lg" />
        <span className="font-display text-xl tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Sunday Strikes
        </span>
      </div>

      {/* Upload button */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={onUpload}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'var(--accent)',
            color: 'var(--acc-text)',
            boxShadow: 'var(--shadow-accent)',
          }}
        >
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Upload Game
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            onClick={onNavClick}
            vsUnreadCount={vsUnreadCount}
          />
        ))}
      </nav>
    </>
  )
}

export default function Layout({ session }) {
  const [activePage, setActivePage] = useState('my-games')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [vsUnreadCount, setVsUnreadCount] = useState(0)
  const [uploadStep, setUploadStep] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [profile, setProfile] = useState(null)
  const profileDefaultsApplied = useRef(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('ss-theme') || 'classic')
  const [cardPreview, setCardPreview] = useState(() => localStorage.getItem('ss_card_preview') ?? 'frames')

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'cosmic') {
      root.classList.add('theme-cosmic')
    } else {
      root.classList.remove('theme-cosmic')
    }
  }, [theme])

  // Apply per-user defaults from Supabase once on first profile load
  useEffect(() => {
    if (profile && !profileDefaultsApplied.current) {
      profileDefaultsApplied.current = true
      if (profile.default_page && NAV_ITEMS.some(i => i.id === profile.default_page)) {
        setActivePage(profile.default_page)
      }
      if (profile.theme_preference) {
        setTheme(profile.theme_preference)
        localStorage.setItem('ss-theme', profile.theme_preference)
      }
    }
  }, [profile])

  async function loadProfile() {
    const { data } = await supabase
      .from('profiles')
      .select('player_label, display_name, theme_preference, default_page, avatar_color')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
  }

  async function loadVsUnreadCount() {
    const { count } = await supabase
      .from('vs_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .is('read_at', null)
    setVsUnreadCount(count ?? 0)
  }

  useEffect(() => {
    loadVsUnreadCount()
    loadProfile()
  }, [])

  function openUpload() { setUploadStep('choose') }
  function closeUpload() { setUploadStep(null) }

  function handleGameSaved() {
    setUploadStep(null)
    setActivePage('my-games')
    setRefreshKey(k => k + 1)
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

  function handleThemeChange(value) {
    setTheme(value)
    localStorage.setItem('ss-theme', value)
  }

  function handleCardPreviewChange(value) {
    setCardPreview(value)
    localStorage.setItem('ss_card_preview', value)
  }

  function handleSaveSettings(updatedProfile) {
    setProfile(prev => ({ ...prev, ...updatedProfile }))
    handleThemeChange(updatedProfile.theme_preference || 'classic')
  }

  function handleUserMenuSave(updates) {
    setProfile(prev => ({ ...prev, ...updates }))
  }

  const currentLabel = NAV_ITEMS.find(i => i.id === activePage)?.label ?? 'Sunday Strikes'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Desktop sidebar ── */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col md:flex"
        style={{ background: 'var(--sidebar)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        <SidebarContent
          activePage={activePage}
          onNavClick={handleNavClick}
          vsUnreadCount={vsUnreadCount}
          onUpload={openUpload}
        />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden modal-overlay">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-72 flex-col slide-in-left"
            style={{ background: 'var(--sidebar)' }}
          >
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-3">
                <img src="/SundayStrikesLogo192.png" alt="Sunday Strikes" className="h-8 w-8 rounded-lg" />
                <span className="font-display text-xl tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  Sunday Strikes
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'rgba(255,255,255,0.4)' }}
                aria-label="Close menu"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="px-3 pt-3 pb-1">
              <button
                onClick={() => { setMobileOpen(false); openUpload() }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--acc-text)',
                  boxShadow: 'var(--shadow-accent)',
                }}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Upload Game
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2">
              {NAV_ITEMS.map(item => (
                <NavItem
                  key={item.id}
                  item={item}
                  isActive={activePage === item.id}
                  onClick={handleNavClick}
                  vsUnreadCount={vsUnreadCount}
                />
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Top header bar ── */}
      <header
        className="fixed left-0 right-0 top-0 z-20 flex h-14 items-center justify-between px-4 md:left-64"
        style={{
          background: 'var(--header)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setMobileOpen(true)}
          className="rounded-lg p-2 transition-colors md:hidden"
          style={{ color: 'var(--sub)' }}
          aria-label="Open menu"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Page title — mobile center */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="font-display text-lg tracking-wide" style={{ color: 'var(--text)' }}>{currentLabel}</span>
          {activePage === 'vs-matches' && vsUnreadCount > 0 && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white" style={{ background: 'var(--loss)' }}>
              {vsUnreadCount}
            </span>
          )}
        </div>

        <div className="hidden md:block" />

        <UserMenu
          session={session}
          theme={theme}
          onThemeChange={handleThemeChange}
          cardPreview={cardPreview}
          onCardPreviewChange={handleCardPreviewChange}
          onProfileSave={handleUserMenuSave}
        />
      </header>

      {/* ── Mobile FAB ── */}
      <button
        onClick={openUpload}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 md:hidden accent-glow"
        style={{
          background: 'var(--accent)',
          boxShadow: 'var(--shadow-accent)',
        }}
        aria-label="Upload game"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      {/* ── Page content ── */}
      <main className="pt-14 md:ml-64">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6">
          {activePage === 'my-games' && (
            <MyGames session={session} refreshKey={refreshKey} onOpenUpload={openUpload} cardPreview={cardPreview} />
          )}
          {activePage === 'find-friends' && <FindFriends session={session} />}
          {activePage === 'vs-matches' && <VSMatches session={session} />}
        </div>
      </main>

      {/* ── Type chooser modal ── */}
      {uploadStep === 'choose' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center modal-overlay"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl modal-enter"
            style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-float)',
            }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-2xl" style={{ color: 'var(--text)' }}>Upload New Game</h3>
              <button
                onClick={closeUpload}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: 'var(--sub)' }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Single Game */}
              <button
                onClick={() => setUploadStep('single')}
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-6 transition-all"
                style={{
                  border: '2px solid var(--border)',
                  background: 'var(--elevated)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--elevated)' }}
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--accent)' }}>
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Single Game</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--sub)' }}>Just you</p>
                </div>
              </button>

              {/* VS Match */}
              <button
                onClick={() => setUploadStep('vs')}
                className="flex flex-col items-center gap-3 rounded-2xl px-4 py-6 transition-all"
                style={{
                  border: '2px solid var(--border)',
                  background: 'var(--elevated)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--elevated)' }}
              >
                <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ color: 'var(--accent)' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>VS Match</p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--sub)' }}>Head-to-head</p>
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

      {settingsOpen && (
        <SettingsModal
          session={session}
          profile={profile}
          theme={theme}
          navItems={NAV_ITEMS}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
