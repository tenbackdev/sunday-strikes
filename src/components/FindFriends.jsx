import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { avatarStyle } from '../lib/avatar'

function ProfileRow({ profile }) {
  if (!profile) return null
  const label = profile.display_name || profile.email || '?'
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={avatarStyle(profile.avatar_color)}
      >
        {label[0].toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{profile.display_name || '(no name)'}</p>
        <p className="truncate text-xs" style={{ color: 'var(--sub)' }}>{profile.email}</p>
      </div>
    </div>
  )
}

function FriendButton({ req, onSend, onRespond }) {
  const baseBtn = 'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95'

  if (!req || req.status === 'declined') {
    return (
      <button
        onClick={onSend}
        className={baseBtn}
        style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
      >
        Add Friend
      </button>
    )
  }
  if (req.status === 'accepted') {
    return (
      <span
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ background: 'color-mix(in srgb, var(--win) 15%, transparent)', color: 'var(--win)' }}
      >
        Friends ✓
      </span>
    )
  }
  if (req.direction === 'sent') {
    return (
      <span
        className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium"
        style={{ background: 'color-mix(in srgb, var(--sub) 12%, transparent)', color: 'var(--sub)' }}
      >
        Request Sent
      </span>
    )
  }
  if (req.direction === 'received') {
    return (
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => onRespond(req.id, 'accepted')}
          className={baseBtn}
          style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
        >
          Accept
        </button>
        <button
          onClick={() => onRespond(req.id, 'declined')}
          className={baseBtn}
          style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
        >
          Decline
        </button>
      </div>
    )
  }
  return null
}

export default function FindFriends({ session }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [dbError, setDbError] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => { loadMyRequests() }, [])

  async function loadMyRequests() {
    setLoadingRequests(true)
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`id, sender_id, receiver_id, status, created_at,
        sender:sender_id(id, display_name, email), receiver:receiver_id(id, display_name, email)`)
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)
    if (error) { setDbError(true); setLoadingRequests(false); return }
    const requests = data || []
    setMyRequests(requests)
    setIncomingRequests(requests.filter(r => r.receiver_id === session.user.id && r.status === 'pending'))
    setLoadingRequests(false)
  }

  function handleSearchChange(e) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    if (!val.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(() => search(val.trim()), 350)
  }

  async function search(q) {
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, email, avatar_color')
      .neq('id', session.user.id)
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10)
    setResults(data || [])
    setSearching(false)
  }

  function getRequestStatus(profileId) {
    const req = myRequests.find(r =>
      (r.sender_id === session.user.id && r.receiver_id === profileId) ||
      (r.receiver_id === session.user.id && r.sender_id === profileId)
    )
    if (!req) return null
    return { ...req, direction: req.sender_id === session.user.id ? 'sent' : 'received' }
  }

  async function sendRequest(receiverId) {
    const { data, error } = await supabase
      .from('friend_requests')
      .insert({ sender_id: session.user.id, receiver_id: receiverId })
      .select(`id, sender_id, receiver_id, status, created_at,
        sender:sender_id(id, display_name, email), receiver:receiver_id(id, display_name, email)`)
      .single()
    if (!error) setMyRequests(prev => [...prev, data])
  }

  async function respondToRequest(requestId, status) {
    const { error } = await supabase.from('friend_requests').update({ status }).eq('id', requestId)
    if (!error) await loadMyRequests()
  }

  if (dbError) {
    return (
      <div
        className="rounded-xl p-6 text-sm"
        style={{ border: '1px solid color-mix(in srgb, var(--loss) 30%, transparent)', background: 'color-mix(in srgb, var(--loss) 8%, transparent)', color: 'var(--loss)' }}
      >
        <p className="font-semibold">Database tables not found</p>
        <p className="mt-1 opacity-80">Run the setup SQL in your Supabase dashboard to enable friend features.</p>
      </div>
    )
  }

  const friends = myRequests
    .filter(r => r.status === 'accepted')
    .map(r => r.sender_id === session.user.id ? r.receiver : r.sender)
    .filter(Boolean)

  const panelStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  }
  const divideStyle = { borderTop: '1px solid var(--border)' }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-3xl" style={{ color: 'var(--text)' }}>Friends</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--sub)' }}>Search for bowlers by name or email address</p>
      </div>

      {/* Search input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--sub)' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={query}
          onChange={handleSearchChange}
          className="w-full rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none transition-all"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-card)',
          }}
          onFocus={e => {
            e.target.style.borderColor = 'var(--accent)'
            e.target.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent)'
          }}
          onBlur={e => {
            e.target.style.borderColor = 'var(--border)'
            e.target.style.boxShadow = 'var(--shadow-card)'
          }}
        />
      </div>

      {/* Search results panel */}
      <div className="overflow-hidden rounded-xl" style={{ ...panelStyle, minHeight: '8rem' }}>
        {!query.trim() ? (
          <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'color-mix(in srgb, var(--sub) 50%, transparent)' }}>
            Start typing to search
          </div>
        ) : searching ? (
          <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--sub)' }}>Searching…</div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--sub)' }}>No users found for "{query}"</div>
        ) : (
          <ul className="max-h-64 overflow-y-auto">
            {results.map((profile, i) => {
              const req = getRequestStatus(profile.id)
              return (
                <li key={profile.id} className="flex items-center justify-between px-4 py-3.5" style={i > 0 ? divideStyle : {}}>
                  <ProfileRow profile={profile} />
                  <FriendButton req={req} onSend={() => sendRequest(profile.id)} onRespond={respondToRequest} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Pending requests */}
      {!loadingRequests && incomingRequests.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Pending Requests</h3>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: 'color-mix(in srgb, var(--loss) 15%, transparent)', color: 'var(--loss)' }}
            >
              {incomingRequests.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl" style={panelStyle}>
            <ul>
              {incomingRequests.map((req, i) => (
                <li key={req.id} className="flex items-center justify-between px-4 py-3.5" style={i > 0 ? divideStyle : {}}>
                  <ProfileRow profile={req.sender} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondToRequest(req.id, 'accepted')}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-all active:scale-95"
                      style={{ background: 'var(--accent)', color: 'var(--acc-text)' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToRequest(req.id, 'declined')}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                      style={{ border: '1px solid var(--border)', color: 'var(--sub)' }}
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* My friends */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>My Friends</h3>
          {!loadingRequests && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}
            >
              {friends.length}
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl" style={panelStyle}>
          {loadingRequests ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--sub)' }}>Loading…</div>
          ) : friends.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm" style={{ color: 'var(--sub)' }}>No friends yet — search above to add some!</div>
          ) : (
            <ul>
              {friends.map((profile, i) => (
                <li key={profile.id} className="px-4 py-3.5" style={i > 0 ? divideStyle : {}}>
                  <ProfileRow profile={profile} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
