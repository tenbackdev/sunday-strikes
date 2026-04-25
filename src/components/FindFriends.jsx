import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export default function FindFriends({ session }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [myRequests, setMyRequests] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [dbError, setDbError] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    loadMyRequests()
  }, [])

  async function loadMyRequests() {
    setLoadingRequests(true)
    const { data, error } = await supabase
      .from('friend_requests')
      .select(`
        id, sender_id, receiver_id, status, created_at,
        sender:sender_id(id, display_name, email),
        receiver:receiver_id(id, display_name, email)
      `)
      .or(`sender_id.eq.${session.user.id},receiver_id.eq.${session.user.id}`)

    if (error) {
      setDbError(true)
      setLoadingRequests(false)
      return
    }

    const requests = data || []
    setMyRequests(requests)
    setIncomingRequests(
      requests.filter(r => r.receiver_id === session.user.id && r.status === 'pending')
    )
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
      .select('id, display_name, email')
      .neq('id', session.user.id)
      .or(`email.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10)
    setResults(data || [])
    setSearching(false)
  }

  function getRequestStatus(profileId) {
    const req = myRequests.find(
      r => (r.sender_id === session.user.id && r.receiver_id === profileId) ||
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
        sender:sender_id(id, display_name, email),
        receiver:receiver_id(id, display_name, email)`)
      .single()
    if (!error) setMyRequests(prev => [...prev, data])
  }

  async function respondToRequest(requestId, status) {
    const { error } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId)
    if (!error) await loadMyRequests()
  }

  if (dbError) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="font-semibold">Database tables not found</p>
        <p className="mt-1 text-amber-700">Run the setup SQL in your Supabase dashboard to enable friend features.</p>
      </div>
    )
  }

  const friends = myRequests
    .filter(r => r.status === 'accepted')
    .map(r => r.sender_id === session.user.id ? r.receiver : r.sender)
    .filter(Boolean)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Friends</h2>
        <p className="mt-1 text-sm text-gray-500">Search for bowlers by name or email address</p>
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={handleSearchChange}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-shadow"
        />
      </div>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm" style={{ minHeight: '10rem' }}>
        {!query.trim() ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-300">Start typing to search</div>
        ) : searching ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-400">Searching…</div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-gray-400">No users found for "{query}"</div>
        ) : (
          <ul className="max-h-64 divide-y divide-gray-50 overflow-y-auto">
            {results.map(profile => {
              const req = getRequestStatus(profile.id)
              return (
                <li key={profile.id} className="flex items-center justify-between px-4 py-3.5">
                  <ProfileRow profile={profile} />
                  <FriendButton req={req} onSend={() => sendRequest(profile.id)} onRespond={respondToRequest} />
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {!loadingRequests && incomingRequests.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Pending Requests</h3>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
              {incomingRequests.length}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <ul className="divide-y divide-gray-50">
              {incomingRequests.map(req => (
                <li key={req.id} className="flex items-center justify-between px-4 py-3.5">
                  <ProfileRow profile={req.sender} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => respondToRequest(req.id, 'accepted')}
                      className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToRequest(req.id, 'declined')}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
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

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">My Friends</h3>
          {!loadingRequests && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {friends.length}
            </span>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          {loadingRequests ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">Loading…</div>
          ) : friends.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-gray-400">No friends yet — search above to add some!</div>
          ) : (
            <ul className="divide-y divide-gray-50">
              {friends.map(profile => (
                <li key={profile.id} className="px-4 py-3.5">
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

function ProfileRow({ profile }) {
  if (!profile) return null
  const label = profile.display_name || profile.email || '?'
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
        {label[0].toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800">{profile.display_name || '(no name)'}</p>
        <p className="truncate text-xs text-gray-400">{profile.email}</p>
      </div>
    </div>
  )
}

function FriendButton({ req, onSend, onRespond }) {
  if (!req || req.status === 'declined') {
    return (
      <button
        onClick={onSend}
        className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
      >
        Add Friend
      </button>
    )
  }
  if (req.status === 'accepted') {
    return (
      <span className="shrink-0 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
        Friends ✓
      </span>
    )
  }
  if (req.direction === 'sent') {
    return (
      <span className="shrink-0 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
        Request Sent
      </span>
    )
  }
  if (req.direction === 'received') {
    return (
      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => onRespond(req.id, 'accepted')}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Accept
        </button>
        <button
          onClick={() => onRespond(req.id, 'declined')}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Decline
        </button>
      </div>
    )
  }
  return null
}
