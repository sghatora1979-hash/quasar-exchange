'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, signOut, type DemoUser } from '@/lib/auth';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null | undefined>(undefined);

  useEffect(() => {
    setUser(getSession());
  }, []);

  useEffect(() => {
    if (user === null) router.push('/login');
  }, [user, router]);

  if (user === undefined) return <div className="p-8 text-center text-gray-500">Loading…</div>;
  if (!user) {
    // Redirect inside an effect, not during render — push-during-render
    // is unreliable on some mobile browsers and can leave a blank page.
    return null;
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold">My account</h1>
      <div className="mt-6 border rounded-2xl p-5 space-y-2 bg-white">
        <Row k="Name" v={user.name} />
        <Row k="Email" v={user.email} />
        <Row k="Phone" v={user.phone} />
        <Row k="ID" v={`${user.idType} ••••${user.idNumber.slice(-4)}`} />
        <Row k="Member since" v={new Date(user.createdAt).toLocaleDateString()} />
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Demo account — stored only in this browser. Paper trading balance: $100,000.
      </p>
      <button
        onClick={() => {
          signOut();
          router.push('/');
        }}
        className="mt-6 w-full border border-red-300 text-red-600 font-bold rounded-xl py-3 hover:bg-red-50"
      >
        Log out
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
