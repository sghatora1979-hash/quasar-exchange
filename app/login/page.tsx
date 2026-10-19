'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startOtp, verifyOtp, loginUser, userExists, registerUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState('');

  function demoLogin() {
    setError('');
    const email = 'demo@quasar.app';
    if (!userExists(email)) {
      registerUser({
        name: 'Demo Trader', email, phone: '+10000000000',
        idType: 'Demo', idNumber: 'DEMO-001', createdAt: Date.now(),
      });
    }
    if (!loginUser(email)) return setError('Demo login failed. Try again.');
    router.push('/trade/QSRUSD');
  }

  function sendCode() {
    setError('');
    if (!/.+@.+\..+/.test(email.trim())) return setError('Please enter a valid email.');
    if (!userExists(email)) {
      router.push('/register');
      return;
    }
    setDemoCode(startOtp(email));
    setStep('otp');
  }

  function confirm() {
    setError('');
    if (!verifyOtp(email, code)) return setError('Wrong or expired code. Try again.');
    if (!loginUser(email)) return setError('No account found for this email.');
    router.push('/trade/QSRUSD');
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold">Log in to Quasar</h1>
      <p className="text-sm text-gray-500 mt-1">Email + demo OTP.</p>

      {step === 'form' ? (
        <div className="mt-6 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            type="email" className="w-full border rounded-xl px-4 py-2.5 bg-white text-black placeholder:text-gray-400" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={sendCode}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Send OTP
          </button>
          <button onClick={demoLogin}
            className="w-full bg-amber-500 text-white font-bold rounded-xl py-3 hover:bg-amber-600">
            🚀 1-Click Demo Login
          </button>
          <p className="text-sm text-center text-gray-500">
            New here? <Link href="/register" className="text-violet-600 font-bold">Create account</Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-600">Demo OTP for <b>{email}</b>:</p>
          <p className="text-3xl font-mono font-extrabold tracking-widest text-center py-3 bg-violet-50 border border-violet-200 rounded-xl">
            {demoCode}
          </p>
          <p className="text-xs text-gray-500 text-center">Demo: any 6-digit code works — no real email is sent.</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code"
            inputMode="numeric" maxLength={6}
            className="w-full border rounded-xl px-4 py-2.5 text-center text-xl tracking-widest bg-white text-black placeholder:text-gray-400" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={confirm}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Verify & log in
          </button>
          <button onClick={() => setStep('form')} className="w-full text-sm text-gray-500">← Back</button>
        </div>
      )}
    </div>
  );
}
