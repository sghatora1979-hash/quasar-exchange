// Quasar demo wallet — DEMO ONLY. Browser-local. No real money moves.
// PIN (SHA-256 hashed) + WebAuthn biometrics (Face ID / fingerprint / Windows Hello)
// where the device supports it. Deposits/withdrawals are simulated and only
// adjust the paper-trading cash balance.

'use client';

import { loadState, saveState } from './quasar';
import { BIP39_WORDS } from './bip39words';

const PIN_KEY = 'quasar-wallet-pin';
const BIO_KEY = 'quasar-wallet-bio';
const TX_KEY = 'quasar-wallet-tx';
const MN_KEY = 'quasar-wallet-mnemonic';

export type WalletTx = {
  id: string;
  time: number;
  type: 'deposit' | 'withdraw';
  method: string; // e.g. 'Bank', 'Card', 'Crypto', 'Exchange'
  detail: string; // e.g. 'HDFC ****1234', 'BTC address bc1…'
  amount: number; // USD
  status: 'completed'; // demo completes instantly
};

// ---------- PIN ----------

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('sha256', new TextEncoder().encode('quasar-pin:' + s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await sha256Hex(pin));
}

export async function checkPin(pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) return false;
    return (await sha256Hex(pin)) === stored;
  } catch {
    return false;
  }
}

// ---------- WebAuthn biometrics ----------

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function biometricsSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      !!navigator.credentials
    );
  } catch {
    return false;
  }
}

export function hasBiometric(): boolean {
  try {
    return !!localStorage.getItem(BIO_KEY);
  } catch {
    return false;
  }
}

/** Register this device's biometrics (Face ID / fingerprint / Hello) for wallet unlock. */
export async function registerBiometric(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!biometricsSupported()) return { ok: false, error: 'Biometrics not supported on this device/browser.' };
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge.buffer as ArrayBuffer,
        rp: { name: 'Quasar Demo Wallet' },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer,
          name: 'quasar-demo-user',
          displayName: 'Quasar Demo User',
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;
    if (!cred) return { ok: false, error: 'No credential created.' };
    localStorage.setItem(BIO_KEY, b64urlEncode(cred.rawId));
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/not allowed|abort|NotAllowed/i.test(msg)) return { ok: false, error: 'Cancelled — try again.' };
    return { ok: false, error: 'Biometric setup failed on this device.' };
  }
}

/** Ask the device biometric to unlock. */
export async function unlockBiometric(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const id = localStorage.getItem(BIO_KEY);
    if (!id) return { ok: false, error: 'Biometrics not set up yet.' };
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge.buffer as ArrayBuffer,
        allowCredentials: [{ id: b64urlDecode(id).buffer as ArrayBuffer, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return assertion ? { ok: true } : { ok: false, error: 'Biometric check failed.' };
  } catch {
    return { ok: false, error: 'Biometric check was cancelled or failed.' };
  }
}

export function removeBiometric() {
  try {
    localStorage.removeItem(BIO_KEY);
  } catch { /* ignore */ }
}

// ---------- Transactions ----------

function readTx(): WalletTx[] {
  try {
    return JSON.parse(localStorage.getItem(TX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeTx(t: WalletTx[]) {
  try {
    localStorage.setItem(TX_KEY, JSON.stringify(t.slice(0, 200)));
  } catch { /* ignore */ }
}

export function getTransactions(): WalletTx[] {
  return readTx();
}

const uid = () => `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Simulate a deposit: adds USD to the paper-trading cash balance. */
export function deposit(amount: number, method: string, detail: string): { ok: true } | { ok: false; error: string } {
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount above $0.' };
  if (amount > 10_000_000) return { ok: false, error: 'Demo limit: $10,000,000 per deposit.' };
  const s = loadState();
  s.cash = Math.round((s.cash + amount) * 100) / 100;
  saveState(s);
  const tx: WalletTx = { id: uid(), time: Date.now(), type: 'deposit', method, detail, amount, status: 'completed' };
  const all = readTx();
  all.unshift(tx);
  writeTx(all);
  return { ok: true };
}

/** Simulate a withdrawal/send: deducts USD from the paper-trading cash balance. */
export function withdraw(amount: number, method: string, detail: string): { ok: true } | { ok: false; error: string } {
  if (!(amount > 0)) return { ok: false, error: 'Enter an amount above $0.' };
  const s = loadState();
  if (amount > s.cash + 1e-9) return { ok: false, error: 'Not enough demo cash.' };
  s.cash = Math.round((s.cash - amount) * 100) / 100;
  saveState(s);
  const tx: WalletTx = { id: uid(), time: Date.now(), type: 'withdraw', method, detail, amount, status: 'completed' };
  const all = readTx();
  all.unshift(tx);
  writeTx(all);
  return { ok: true };
}

export function getWalletBalance(): number {
  return loadState().cash;
}

// ---------- Recovery phrase (demo) ----------

/**
 * Generate a 24-word demo recovery phrase from the BIP-39 wordlist.
 * DEMO ONLY: it does not derive real keys or control real funds.
 * (BIP-39 standard = 12/15/18/21/24 words; 34 words is non-standard.)
 */
export function generateMnemonic(): string[] {
  const words: string[] = [];
  const rand = crypto.getRandomValues(new Uint8Array(24));
  for (let i = 0; i < 24; i++) {
    words.push(BIP39_WORDS[rand[i] % 2048]);
  }
  return words;
}

export function hasMnemonic(): boolean {
  try {
    return !!localStorage.getItem(MN_KEY);
  } catch {
    return false;
  }
}

export function saveMnemonic(words: string[]): void {
  try {
    localStorage.setItem(MN_KEY, JSON.stringify(words));
  } catch { /* ignore */ }
}

export function getMnemonic(): string[] | null {
  try {
    const raw = localStorage.getItem(MN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}
