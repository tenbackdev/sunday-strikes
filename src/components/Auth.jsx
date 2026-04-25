import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="/SundayStrikesLogo192.png"
            alt="Sunday Strikes"
            className="h-16 w-16"
          />
          <h1 className="text-2xl font-semibold text-gray-800">Sunday Strikes</h1>
        </div>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo={window.location.origin}
        />
      </div>
    </div>
  )
}
