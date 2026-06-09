const KEY = 'ss_upload_prefs'
const OPP_KEY = 'ss_opponent_pref'
const OPP_TTL_MS = 7 * 24 * 60 * 60 * 1000

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function loadUploadPrefs() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const prefs = JSON.parse(raw)
    if (prefs.date !== today()) return null
    return prefs
  } catch {
    return null
  }
}

export function saveUploadPrefs(updates) {
  const existing = loadUploadPrefs() ?? { date: today() }
  localStorage.setItem(KEY, JSON.stringify({ ...existing, ...updates, date: today() }))
}

export function loadOpponentPref() {
  try {
    const raw = localStorage.getItem(OPP_KEY)
    if (!raw) return null
    const { friend, savedAt } = JSON.parse(raw)
    if (Date.now() - savedAt > OPP_TTL_MS) return null
    return friend
  } catch {
    return null
  }
}

export function saveOpponentPref(friend) {
  localStorage.setItem(OPP_KEY, JSON.stringify({ friend, savedAt: Date.now() }))
}
