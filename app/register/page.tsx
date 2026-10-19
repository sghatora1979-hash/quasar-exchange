'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startOtp, verifyOtp, registerUser, userExists, ID_TYPES } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [idType, setIdType] = useState<string>(ID_TYPES[0]);
  const [idNumber, setIdNumber] = useState('');
  const [code, setCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState('');

  const validEmail = /.+@.+\..+/.test(email.trim());

  function sendCode() {
    setError('');
    if (!name.trim()) return setError('Please enter your name.');
    if (!validEmail) return setError('Please enter a valid email.');
    // Demo: phone + ID are OPTIONAL — name + email is enough to start.
    if (userExists(email)) {
      // Tell the user WHY instead of silently jumping to Login —
      // a silent redirect feels like "register is not working".
      setError('This email already has an account. Taking you to Log in…');
      setTimeout(() => router.push('/login'), 1500);
      return;
    }
    const c = startOtp(email);
    setDemoCode(c);
    setStep('otp');
  }

  function confirm() {
    setError('');
    if (!verifyOtp(email, code)) return setError('Wrong or expired code. Try again.');
    registerUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      idType,
      idNumber: idNumber.trim(),
      createdAt: Date.now(),
    });
    router.push('/trade/QSRUSD');
  }

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold">Create your Quasar account</h1>
      <p className="text-sm text-gray-500 mt-1">
        Email + phone + ID. One demo OTP — then start paper trading.
      </p>
      <p className="text-xs mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
        Demo only: accounts live in this browser. No real money, no real KYC — a real
        exchange needs licensed identity verification.
      </p>

      {step === 'form' ? (
        <div className="mt-6 space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
            className="w-full border rounded-xl px-4 py-2.5 bg-white text-black placeholder:text-gray-400" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
            type="email" className="w-full border rounded-xl px-4 py-2.5 bg-white text-black placeholder:text-gray-400" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
            type="tel" className="w-full border rounded-xl px-4 py-2.5 bg-white text-black placeholder:text-gray-400" />
          <div className="flex gap-2">
            <select value={idType} onChange={(e) => setIdType(e.target.value)}
              className="border rounded-xl px-3 py-2.5 bg-white text-black">
              {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)}
              placeholder="ID number (optional)" className="flex-1 border rounded-xl px-4 py-2.5 bg-white text-black placeholder:text-gray-400" />
          </div>
          <p className="text-xs text-gray-500">Demo: only <b>name + email</b> needed. Phone &amp; ID are optional.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={sendCode}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Send OTP
          </button>
          <p className="text-sm text-center text-gray-500">
            Already have an account? <Link href="/login" className="text-violet-600 font-bold">Log in</Link>
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-600">
            Demo OTP for <b>{email}</b>:
          </p>
          <p className="text-3xl font-mono font-extrabold tracking-widest text-center py-3 bg-violet-50 border border-violet-200 rounded-xl">
            {demoCode}
          </p>
          <p className="text-xs text-gray-500 text-center">
            In a real exchange this arrives by SMS/email. Here it is shown on screen because this is a demo.
            <br /><b>Demo: any 6-digit code works</b> — no real email is sent.
          </p>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter 6-digit code"
            inputMode="numeric" maxLength={6}
            className="w-full border rounded-xl px-4 py-2.5 text-center text-xl tracking-widest bg-white text-black placeholder:text-gray-400" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={confirm}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Verify & start trading
          </button>
          <button onClick={() => setStep('form')} className="w-full text-sm text-gray-500">
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
