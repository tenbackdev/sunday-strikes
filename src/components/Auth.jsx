import { Auth } from '@supabase/auth-ui-react'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
      style={{ background: 'var(--bg)' }}
    >
      {/* Subtle radial accent behind the card */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 50% 40%, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)`,
        }}
      />

      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-8"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-float)',
        }}
      >
        {/* Logo + wordmark */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="relative flex h-16 w-16 items-center justify-center rounded-full"
            style={{
              background: `color-mix(in srgb, var(--accent) 12%, transparent)`,
              boxShadow: `0 0 0 1px color-mix(in srgb, var(--accent) 25%, transparent)`,
            }}
          >
            <img
              src="/SundayStrikesLogo192.png"
              alt="Sunday Strikes"
              className="h-10 w-10 object-contain"
            />
          </div>
          <div className="text-center">
            <h1
              className="font-display text-4xl tracking-widest"
              style={{ color: 'var(--text)' }}
            >
              Sunday Strikes
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--sub)' }}>
              Track your games. Beat your friends.
            </p>
          </div>
        </div>

        <Auth
          supabaseClient={supabase}
          providers={['google']}
          redirectTo={window.location.origin}
          appearance={{
            variables: {
              default: {
                colors: {
                  brand:                 'var(--accent)',
                  brandAccent:           'var(--accent-h)',
                  brandButtonText:       'var(--acc-text)',
                  inputBackground:       'var(--elevated)',
                  inputBorder:           'var(--border)',
                  inputBorderFocus:      'var(--accent)',
                  inputBorderHover:      'var(--sub)',
                  inputText:             'var(--text)',
                  inputPlaceholder:      'var(--sub)',
                  messageText:           'var(--sub)',
                  messageTextDanger:     'var(--loss)',
                  anchorTextColor:       'var(--accent)',
                  anchorTextHoverColor:  'var(--accent-h)',
                  dividerBackground:     'var(--border)',
                  defaultButtonBackground:       'var(--elevated)',
                  defaultButtonBackgroundHover:  'var(--border)',
                  defaultButtonBorder:           'var(--border)',
                  defaultButtonText:             'var(--text)',
                },
                borderWidths: {
                  buttonBorderWidth: '1px',
                  inputBorderWidth:  '1px',
                },
                radii: {
                  borderRadiusButton: '10px',
                  buttonBorderRadius: '10px',
                  inputBorderRadius:  '10px',
                },
                fontSizes: {
                  baseBodySize:  '14px',
                  baseInputSize: '14px',
                  baseLabelSize: '12px',
                },
                space: {
                  inputPadding:  '10px 12px',
                  buttonPadding: '10px 16px',
                },
              },
            },
          }}
        />
      </div>
    </div>
  )
}
