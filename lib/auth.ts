// Quasar demo auth — DEMO ONLY. Browser-local accounts, no real verification.
// Registration: name + email + phone + ID → demo OTP (shown on screen) → account.
// Real exchanges need licensed KYC (FINTRAC MSB in Canada etc.). This is a demo.

'use client';

export type DemoUser = {
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  createdAt: number;
};

const USERS_KEY = 'quasar-demo-users';
const SESSION_KEY = 'quasar-demo-session';
const OTP_KEY = 'quasar-demo-otp';

function readUsers(): Record<string, DemoUser> {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function writeUsers(u: Record<string, DemoUser>) {
  localStorage.setItem(USERS_KEY, JSON.stringify(u));
}

export function getSession(): DemoUser | null {
  try {
    const email = localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    return readUsers()[email.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

export function signOut() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

/** Start registration/login: create a demo OTP for this email. Returns the code (demo: shown on screen). */
export function startOtp(email: string): string {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  try {
    const all = JSON.parse(localStorage.getItem(OTP_KEY) ?? '{}');
    all[email.toLowerCase()] = { code, at: Date.now() };
    localStorage.setItem(OTP_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
  return code;
}

export function verifyOtp(email: string, code: string): boolean {
  // DEMO MODE (Sandeep's instruction): any 6-digit code is accepted — no real
  // email/SMS is ever sent. The on-screen code is just a demo preview showing
  // how a real exchange would work. Production needs a real verifier.
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) return true;
  try {
    const all = JSON.parse(localStorage.getItem(OTP_KEY) ?? '{}');
    const rec = all[email.toLowerCase()];
    if (!rec) return false;
    if (Date.now() - rec.at > 10 * 60 * 1000) return false; // 10 min expiry
    return rec.code === trimmed;
  } catch {
    return false;
  }
}

function clearOtp(email: string) {
  try {
    const all = JSON.parse(localStorage.getItem(OTP_KEY) ?? '{}');
    delete all[email.toLowerCase()];
    localStorage.setItem(OTP_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function userExists(email: string): boolean {
  return !!readUsers()[email.toLowerCase()];
}

/** Complete registration after OTP verified. */
export function registerUser(u: DemoUser): void {
  const users = readUsers();
  users[u.email.toLowerCase()] = u;
  writeUsers(users);
  clearOtp(u.email);
  try {
    localStorage.setItem(SESSION_KEY, u.email.toLowerCase());
  } catch { /* ignore */ }
}

/** Complete login after OTP verified. Returns false if no account. */
export function loginUser(email: string): boolean {
  const key = email.toLowerCase();
  if (!readUsers()[key]) return false;
  clearOtp(email);
  try {
    localStorage.setItem(SESSION_KEY, key);
  } catch { /* ignore */ }
  return true;
}

export const ID_TYPES = ['Aadhaar', 'PAN Card', 'Passport', "Driver's Licence", 'Voter ID'] as const;
