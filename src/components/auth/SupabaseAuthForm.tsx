'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

type AuthMode = 'sign-in' | 'sign-up'

interface SupabaseAuthFormProps {
  mode: AuthMode
}

export function SupabaseAuthForm({ mode }: SupabaseAuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const redirectUrl = searchParams.get('redirect_url') || '/onboarding'
  const isSignUp = mode === 'sign-up'

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectUrl)}`,
          },
        })
        if (error) throw error
        toast({
          title: 'Check your email',
          description: 'Confirm your account via the link we sent you, or sign in if already confirmed.',
        })
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push(redirectUrl)
        router.refresh()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: isSignUp ? 'Sign up failed' : 'Sign in failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect_url=${encodeURIComponent(redirectUrl)}`,
      },
    })
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Google sign in failed',
        description: error.message,
      })
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isSignUp ? 'Create account' : 'Welcome back'}</CardTitle>
        <CardDescription>
          {isSignUp
            ? 'Sign up with email or Google to join Optimix'
            : 'Sign in to continue to Optimix'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleEmailAuth}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={handleGoogleAuth} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue with Google'}
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isSignUp ? (
              'Sign up'
            ) : (
              'Sign in'
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <Link href="/auth" className="text-primary underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New here?{' '}
                <Link href="/auth/sign-up" className="text-primary underline-offset-4 hover:underline">
                  Create account
                </Link>
              </>
            )}
          </p>
        </CardFooter>
      </form>
    </Card>
  )
}
