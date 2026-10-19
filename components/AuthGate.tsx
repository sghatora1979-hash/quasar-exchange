'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSession, type DemoUser } from '@/lib/auth';

/** Blocks children until a demo account is logged in. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getSession());
  }, []);

  if (user === undefined) {
    return <div className="p-8 text-center text-gray-500">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Log in to trade</h1>
        <p className="text-sm text-gray-500 mt-2">
          Create a free demo account (email + phone + ID, one OTP) to start paper trading.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/register"
            className="bg-violet-600 text-white font-bold rounded-xl px-6 py-3 hover:bg-violet-700">
            Register
          </Link>
          <Link href="/login"
            className="border border-violet-600 text-violet-700 font-bold rounded-xl px-6 py-3">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/** Small account chip for the header. */
export function AccountChip() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getSession());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Link href="/login" className="font-bold text-violet-700">Log in</Link>
        <Link href="/register"
          className="bg-violet-600 text-white font-bold rounded-lg px-3 py-1.5 hover:bg-violet-700">
          Register
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="hidden sm:inline text-gray-600">
        👋 {user.name.split(' ')[0]}
      </span>
      <Link href="/account" className="font-bold text-violet-700">Account</Link>
    </div>
  );
}
