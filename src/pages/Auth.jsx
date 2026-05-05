import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from '../components/ui/Button'
import Input  from '../components/ui/Input'
import { Dumbbell, Mail, CheckCircle } from 'lucide-react'

export default function Auth() {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function handleSend(e) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError('')

    // redirectTo must be whitelisted in Supabase → Auth → URL Configuration
    const redirectTo = window.location.origin + window.location.pathname

    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center h-full bg-sys-bg dark:bg-black px-6"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Icon */}
      <div className="w-24 h-24 rounded-ios-xl bg-ios-blue flex items-center justify-center shadow-ios-card mb-8">
        <Dumbbell size={44} className="text-white" strokeWidth={2} />
      </div>

      <h1 className="text-3xl font-bold text-sys-label dark:text-white mb-2 tracking-tight">
        Workout Tracker
      </h1>
      <p className="text-sys-label2 dark:text-white/50 text-base mb-10 text-center">
        Personal training log
      </p>

      {sent ? (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <CheckCircle size={48} className="text-ios-green" />
          <p className="text-center text-sys-label dark:text-white font-medium">
            Check your email
          </p>
          <p className="text-center text-sm text-sys-label2 dark:text-white/50">
            We sent a magic link to <strong>{email}</strong>. Tap it to sign in.
          </p>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-ios-blue text-sm mt-2 active:opacity-60"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="w-full max-w-xs flex flex-col gap-4">
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
            required
          />

          {error && (
            <p className="text-ios-red text-sm text-center">{error}</p>
          )}

          <Button type="submit" fullWidth disabled={loading || !email}>
            <Mail size={18} className="mr-2" />
            {loading ? 'Sending…' : 'Send Magic Link'}
          </Button>

          <p className="text-xs text-sys-label3 dark:text-white/30 text-center">
            You'll receive a sign-in link — no password needed.
          </p>
        </form>
      )}
    </div>
  )
}
