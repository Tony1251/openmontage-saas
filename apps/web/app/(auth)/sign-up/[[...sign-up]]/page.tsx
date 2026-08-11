'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const isMock = true; // MOCK_MODE is set in env

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');

  if (!isMock) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SignUp } = require('@clerk/nextjs');
    return (
      <div className="w-full max-w-sm">
        <SignUp />
      </div>
    );
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    localStorage.setItem('mock_token', btoa(JSON.stringify({ email, role: 'user', workspaceName })));
    localStorage.setItem('mock_workspace', workspaceName);
    router.push('/dashboard');
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Start generating AI video in minutes</p>
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
          <Label htmlFor="workspace">Workspace name</Label>
          <Input
            id="workspace"
            type="text"
            placeholder="My Studio"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500">
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-purple-400 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
