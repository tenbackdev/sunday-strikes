import { useState } from 'react'
import { supabase } from '../lib/supabase'

const MONO = "'JetBrains Mono', 'Courier New', monospace"
const SANS = "'Space Grotesk', 'Inter', sans-serif"

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.6 2.4 30.1 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.9 6.2C12.2 13.5 17.6 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.6-9.6 6.6-16z"/>
    <path fill="#FBBC05" d="M10.4 28.4c-.5-1.4-.8-3-.8-4.4s.3-3 .8-4.4l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.6l7.9-6.2z"/>
    <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.1-5.5c-2 1.3-4.6 2.1-7.9 2.1-6.4 0-11.8-4-13.6-9.7l-7.9 6.2C6.4 42.6 14.6 48 24 48z"/>
  </svg>
)

function InputField({ label, id, type = 'text', value, onChange, placeholder }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: 'block',
          fontFamily: MONO,
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'var(--sub)',
          marginBottom: 6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={type === 'password' ? (show ? 'text' : 'password') : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            display: 'block',
            width: '100%',
            height: 48,
            borderRadius: 11,
            border: '1px solid var(--border)',
            background: 'var(--elevated)',
            color: 'var(--text)',
            fontFamily: SANS,
            fontSize: 15,
            padding: '0 14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--sub)',
              fontFamily: MONO,
              fontSize: 12,
            }}
          >
            {show ? '🙈' : '👁'}
          </button>
        )}
      </div>
    </div>
  )
}

function FooterLink({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'var(--accent)',
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

export default function AuthScreen() {
  const [view, setView] = useState('sign_in') // 'sign_in' | 'sign_up' | 'forgot_password'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  function clearMessages() {
    setError(null)
    setMessage(null)
  }

  function switchTo(v) {
    clearMessages()
    setView(v)
  }

  async function handleGoogle() {
    setLoading(true)
    clearMessages()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    setLoading(false)
  }

  async function handleSignIn(e) {
    e.preventDefault()
    setLoading(true)
    clearMessages()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    setLoading(true)
    clearMessages()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) setError(error.message)
    else setMessage('Check your email for a confirmation link.')
    setLoading(false)
  }

  async function handleResetPassword(e) {
    e.preventDefault()
    setLoading(true)
    clearMessages()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    if (error) setError(error.message)
    else setMessage('Check your email for a password reset link.')
    setLoading(false)
  }

  const isSignIn = view === 'sign_in'
  const isSignUp = view === 'sign_up'
  const isForgot = view === 'forgot_password'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        fontFamily: SANS,
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 30px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Radial accent — matches design handoff exactly */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'radial-gradient(ellipse 70% 45% at 50% 22%, rgba(206,27,14,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ position: 'relative', width: '100%', maxWidth: 330 }}>
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 34 }}>
          <img
            src="/SundayStrikesLogo192.png"
            alt="Sunday Strikes"
            style={{
              width: 88,
              height: 88,
              borderRadius: 22,
              boxShadow: '0 10px 30px -8px rgba(60,40,15,0.45), 0 0 0 1px rgba(60,40,15,0.08)',
            }}
          />
          <h1
            style={{
              margin: '20px 0 0',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 32,
              letterSpacing: '-0.02em',
              color: 'var(--text)',
            }}
          >
            Sunday Strikes
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--sub)' }}>
            Track your games. Beat your friends.
          </p>
        </div>

        {/* Error / success messages */}
        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(206,27,14,0.08)',
              border: '1px solid rgba(206,27,14,0.2)',
              color: 'var(--loss)',
              fontFamily: SANS,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}
        {message && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(45,122,65,0.08)',
              border: '1px solid rgba(45,122,65,0.2)',
              color: 'var(--win)',
              fontFamily: SANS,
              fontSize: 13,
              textAlign: 'center',
            }}
          >
            {message}
          </div>
        )}

        <form
          onSubmit={isSignIn ? handleSignIn : isSignUp ? handleSignUp : handleResetPassword}
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
        >
          {/* Google — always first, above email */}
          {!isForgot && (
            <button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              style={{
                height: 50,
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--card)',
                color: 'var(--text)',
                fontFamily: SANS,
                fontWeight: 600,
                fontSize: 14.5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: '0 1px 2px rgba(60,40,15,0.05)',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
          )}

          {/* OR divider */}
          {!isForgot && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: 'var(--sub)',
                }}
              >
                OR
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* Email */}
          <InputField
            label="Email"
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@email.com"
          />

          {/* Password — hidden on forgot password view */}
          {!isForgot && (
            <InputField
              label="Password"
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Your password"
            />
          )}

          {/* Primary action button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              height: 50,
              marginTop: 4,
              borderRadius: 12,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--acc-text)',
              fontFamily: SANS,
              fontWeight: 700,
              fontSize: 15.5,
              cursor: 'pointer',
            }}
          >
            {isSignIn && (loading ? 'Signing in…' : 'Sign In')}
            {isSignUp && (loading ? 'Creating account…' : 'Create Account')}
            {isForgot && (loading ? 'Sending…' : 'Send Reset Email')}
          </button>
        </form>

        {/* Footer links — same style throughout */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 26 }}>
          {isSignIn && (
            <>
              <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: 'var(--sub)' }}>
                Forgot your password?{' '}
                <FooterLink onClick={() => switchTo('forgot_password')}>Reset it</FooterLink>
              </p>
              <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: 'var(--sub)' }}>
                New here?{' '}
                <FooterLink onClick={() => switchTo('sign_up')}>Create an account</FooterLink>
              </p>
            </>
          )}
          {isSignUp && (
            <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: 'var(--sub)' }}>
              Already have an account?{' '}
              <FooterLink onClick={() => switchTo('sign_in')}>Sign in</FooterLink>
            </p>
          )}
          {isForgot && (
            <p style={{ textAlign: 'center', margin: 0, fontSize: 13, color: 'var(--sub)' }}>
              Remember your password?{' '}
              <FooterLink onClick={() => switchTo('sign_in')}>Sign in</FooterLink>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
