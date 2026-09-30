import { useState, useEffect } from 'react'
import { fetchExportableGames, buildGamesJSON, buildFramesCSV, downloadFile, exportFilename } from '../lib/exportData'
import { supabase } from '../lib/supabase'

export default function Admin({ session }) {
  const [gameCount, setGameCount] = useState(null)
  const [exporting, setExporting] = useState(null)
  const [error, setError] = useState(null)

  async function loadCount() {
    const { count } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
    setGameCount(count ?? 0)
  }

  useEffect(() => { loadCount() }, [])

  async function handleExport(format) {
    setError(null)
    setExporting(format)
    try {
      const games = await fetchExportableGames(session)
      if (format === 'json') {
        downloadFile(exportFilename('json'), buildGamesJSON(games), 'application/json')
      } else {
        downloadFile(exportFilename('csv'), buildFramesCSV(games), 'text/csv')
      }
    } catch (err) {
      setError('Export failed. ' + err.message)
    } finally {
      setExporting(null)
    }
  }

  const panelStyle = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-card)',
  }

  const hasGames = gameCount !== null && gameCount > 0

  return (
    <div className="space-y-6" style={{ marginTop: -24, paddingTop: 16 }}>
      <div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'var(--sub)', marginBottom: 4 }}>YOUR ACCOUNT</p>
        <h2 className="font-display text-3xl" style={{ color: 'var(--text)' }}>Admin</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--sub)' }}>Manage and export your own data</p>
      </div>

      <div className="rounded-xl p-5" style={panelStyle}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 10.5, letterSpacing: '0.12em', color: 'var(--text)', marginBottom: 6 }}>DATA EXPORT</div>
        <p className="text-sm" style={{ color: 'var(--sub)' }}>
          Download the raw scores and frame-by-frame ball detail for every game you've recorded
          {gameCount !== null && (
            <> — <span style={{ color: 'var(--text)', fontWeight: 600 }}>{gameCount} game{gameCount === 1 ? '' : 's'}</span> ready to export</>
          )}.
          {' '}For VS matches, only your own game is included — opponent data is never exported.
        </p>

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'var(--loss)' }}>{error}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => handleExport('csv')}
            disabled={!hasGames || exporting !== null}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            style={{ background: 'var(--accent)', color: 'var(--acc-text)', boxShadow: 'var(--shadow-accent)' }}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting === 'csv' ? 'Exporting…' : 'Export as CSV'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={!hasGames || exporting !== null}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
            style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--elevated)' }}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting === 'json' ? 'Exporting…' : 'Export as JSON'}
          </button>
        </div>

        {gameCount === 0 && (
          <p className="mt-3 text-xs" style={{ color: 'color-mix(in srgb, var(--sub) 60%, transparent)' }}>
            You don't have any games yet — upload one to enable export.
          </p>
        )}
      </div>
    </div>
  )
}
