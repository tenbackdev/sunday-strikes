const KEY = 'ss_upload_prefs'

function today() {
  return new Date().toISOString().slice(0, 10)
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
