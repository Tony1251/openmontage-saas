'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const isMock = true; // MOCK_MODE is set in env

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isMock) {
    // Dynamic import to avoid build-time Clerk dependency on server
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SignIn } = require('@clerk/nextjs');
    return (
      <div className="w-full max-w-sm">
        <SignIn />
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem('mock_token', btoa(JSON.stringify({ email, role: 'user' })));
    router.push('/dashboard');
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&rsquo;t have an account?{' '}
        <Link href="/sign-up" className="text-purple-400 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
