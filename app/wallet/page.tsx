'use client';

import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, Fingerprint, ArrowDownToLine, ArrowUpFromLine, Lock, Plus, X } from 'lucide-react';
import {
  hasPin, setPin, checkPin,
  biometricsSupported, hasBiometric, registerBiometric, unlockBiometric, removeBiometric,
  deposit, withdraw, getTransactions, getWalletBalance,
  generateMnemonic, hasMnemonic, saveMnemonic, getMnemonic,
  type WalletTx,
} from '@/lib/wallet';
import { fmtUSD } from '@/lib/quasar';

type Screen = 'loading' | 'setup' | 'locked' | 'open';

const DEPOSIT_METHODS = ['Bank transfer', 'Debit / Credit card', 'Crypto deposit'];
const SEND_METHODS = ['Bank account', 'Other exchange', 'Crypto wallet'];

export default function WalletPage() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [pin, setPinInput] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [bioAvail] = useState(() => biometricsSupported());
  const [bioOn, setBioOn] = useState(false);
  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [modal, setModal] = useState<null | 'deposit' | 'send'>(null);

  useEffect(() => {
    setBioOn(hasBiometric());
    setScreen(hasPin() ? 'locked' : 'setup');
  }, []);

  function refresh() {
    setBalance(getWalletBalance());
    setTxs(getTransactions());
  }

  async function createPin() {
    setError('');
    if (!/^\d{4}$/.test(pin)) return setError('PIN must be 4 digits.');
    if (pin !== pin2) return setError('PINs do not match.');
    await setPin(pin);
    setPinInput(''); setPin2('');
    refresh();
    setScreen('open');
  }

  async function unlock() {
    setError('');
    if (await checkPin(pin)) {
      setPinInput('');
      refresh();
      setScreen('open');
    } else {
      setError('Wrong PIN. Try again.');
    }
  }

  async function bioUnlock() {
    setError('');
    const r = await unlockBiometric();
    if (r.ok) {
      refresh();
      setScreen('open');
    } else {
      setError(r.error);
    }
  }

  async function toggleBio() {
    setError('');
    if (bioOn) {
      removeBiometric();
      setBioOn(false);
    } else {
      const r = await registerBiometric();
      if (r.ok) setBioOn(true);
      else setError(r.error);
    }
  }

  if (screen === 'loading') return <div className="p-8 text-center text-slate-400">Loading wallet…</div>;

  // ---------- Setup ----------
  if (screen === 'setup') {
    return (
      <div className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <WalletIcon size={24} /> Set up your wallet
        </h1>
        <p className="text-sm text-slate-400 mt-1">Create a 4-digit PIN to lock your demo wallet.</p>
        <p className="text-xs mt-2 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300">
          Demo only — no real money. PIN lives in this browser.
        </p>
        <div className="mt-6 space-y-3">
          <input value={pin} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="4-digit PIN" inputMode="numeric" type="password" maxLength={4}
            className="w-full border border-edge rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] bg-panel text-white" />
          <input value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="Confirm PIN" inputMode="numeric" type="password" maxLength={4}
            className="w-full border border-edge rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] bg-panel text-white" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={createPin}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Create wallet
          </button>
        </div>
      </div>
    );
  }

  // ---------- Locked ----------
  if (screen === 'locked') {
    return (
      <div className="max-w-md mx-auto px-4 py-10 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center">
          <Lock size={28} className="text-violet-300" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mt-4">Wallet locked</h1>
        <p className="text-sm text-slate-400 mt-1">Enter your PIN{bioOn ? ' or use biometrics' : ''}.</p>
        <div className="mt-6 space-y-3">
          <input value={pin} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onKeyDown={(e) => e.key === 'Enter' && unlock()}
            placeholder="••••" inputMode="numeric" type="password" maxLength={4}
            className="w-full border border-edge rounded-xl px-4 py-3 text-center text-2xl tracking-[0.5em] bg-panel text-white" />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={unlock}
            className="w-full bg-violet-600 text-white font-bold rounded-xl py-3 hover:bg-violet-700">
            Unlock with PIN
          </button>
          {bioOn && (
            <button onClick={bioUnlock}
              className="w-full border border-edge rounded-xl py-3 font-bold text-white flex items-center justify-center gap-2 hover:bg-panel">
              <Fingerprint size={18} /> Unlock with Face ID / Fingerprint
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---------- Open ----------
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <WalletIcon size={24} /> My Wallet
        </h1>
        <button onClick={() => setScreen('locked')}
          className="text-sm font-bold text-slate-300 border border-edge rounded-lg px-3 py-1.5 hover:bg-panel">
          <Lock size={14} className="inline mr-1" /> Lock
        </button>
      </div>
      <p className="text-xs mt-1 px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 inline-block">
        Demo wallet — simulated deposits only. No real money, cards, or crypto move.
      </p>

      <div className="mt-4 border border-edge rounded-2xl p-6 bg-panel/60 text-center">
        <p className="text-xs uppercase tracking-widest text-slate-400">Demo balance</p>
        <p className="text-4xl font-black text-white mt-1">{fmtUSD(balance)}</p>
        <div className="mt-4 flex gap-3 justify-center">
          <button onClick={() => setModal('deposit')}
            className="flex items-center gap-2 bg-emerald-600 text-white font-bold rounded-xl px-5 py-2.5 hover:bg-emerald-700">
            <ArrowDownToLine size={16} /> Deposit
          </button>
          <button onClick={() => setModal('send')}
            className="flex items-center gap-2 bg-sky-600 text-white font-bold rounded-xl px-5 py-2.5 hover:bg-sky-700">
            <ArrowUpFromLine size={16} /> Send / Withdraw
          </button>
        </div>
      </div>

      {bioAvail && (
        <button onClick={toggleBio}
          className="mt-3 w-full border border-edge rounded-xl py-3 font-bold text-white flex items-center justify-center gap-2 hover:bg-panel">
          <Fingerprint size={18} className={bioOn ? 'text-emerald-400' : 'text-slate-400'} />
          {bioOn ? 'Face ID / Fingerprint is ON — tap to remove' : 'Enable Face ID / Fingerprint unlock'}
        </button>
      )}
      <RecoveryPhrase />
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      <h2 className="text-lg font-bold text-white mt-6 mb-2">History</h2>
      {txs.length === 0 ? (
        <p className="text-sm text-slate-500">No transactions yet. Make a demo deposit to begin.</p>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => (
            <div key={t.id} className="border border-edge rounded-xl px-4 py-3 bg-panel/40 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">
                  {t.type === 'deposit' ? 'Deposit' : 'Sent'} · {t.method}
                </p>
                <p className="text-xs text-slate-400">{t.detail} · {new Date(t.time).toLocaleString()}</p>
              </div>
              <p className={`font-black ${t.type === 'deposit' ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.type === 'deposit' ? '+' : '−'}{fmtUSD(t.amount)}
              </p>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TxModal
          mode={modal}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

function RecoveryPhrase() {
  const [words, setWords] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (hasMnemonic()) setWords(getMnemonic());
  }, []);

  function create() {
    const w = generateMnemonic();
    saveMnemonic(w);
    setWords(w);
    setRevealed(true);
  }

  if (!words) {
    return (
      <button onClick={create}
        className="mt-3 w-full border border-edge rounded-xl py-3 font-bold text-white hover:bg-panel">
        📝 Create 24-word recovery phrase
      </button>
    );
  }

  return (
    <div className="mt-3 border border-edge rounded-xl p-4 bg-panel/40">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">📝 Recovery phrase (24 words)</p>
        <button onClick={() => setRevealed(!revealed)}
          className="text-xs font-bold text-accent2 hover:underline">
          {revealed ? 'Hide' : 'Reveal'}
        </button>
      </div>
      <p className="text-xs text-amber-300/90 mt-1">
        Demo only — practise writing it down. Never share it. It controls no real funds.
      </p>
      {revealed && (
        <>
          <div className="grid grid-cols-3 gap-1.5 mt-3">
            {words.map((w, i) => (
              <div key={i} className="text-xs bg-void border border-edge rounded-lg px-2 py-1.5 text-slate-200">
                <span className="text-slate-500 mr-1">{i + 1}.</span>{w}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(words.join(' ')).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="mt-3 text-xs font-bold text-slate-300 border border-edge rounded-lg px-3 py-1.5 hover:bg-panel2"
          >
            {copied ? 'Copied!' : 'Copy (demo only — real phrases: paper, never digital)'}
          </button>
        </>
      )}
    </div>
  );
}

function TxModal({ mode, onClose, onDone }: { mode: 'deposit' | 'send'; onClose: () => void; onDone: () => void }) {  const [method, setMethod] = useState(mode === 'deposit' ? DEPOSIT_METHODS[0] : SEND_METHODS[0]);
  const [detail, setDetail] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const placeholders: Record<string, string> = {
    'Bank transfer': 'Bank name + last 4 digits (e.g. HDFC ****4821)',
    'Debit / Credit card': 'Card nickname (e.g. Visa ****3344)',
    'Crypto deposit': 'Coin + network (e.g. ETH on Ethereum)',
    'Bank account': 'Account / IBAN (e.g. RBC ****9921)',
    'Other exchange': 'Exchange name (e.g. Kraken)',
    'Crypto wallet': 'Wallet address (e.g. 0x…)',
  };

  function submit() {
    setError('');
    const amt = parseFloat(amount);
    const r = mode === 'deposit'
      ? deposit(amt, method, detail.trim() || method)
      : withdraw(amt, method, detail.trim() || method);
    if (!r.ok) return setError(r.error);
    onDone();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel border border-edge rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            {mode === 'deposit' ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
            {mode === 'deposit' ? 'Demo deposit' : 'Demo send / withdraw'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Method</p>
            <div className="flex flex-wrap gap-2">
              {(mode === 'deposit' ? DEPOSIT_METHODS : SEND_METHODS).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`text-sm font-bold rounded-lg px-3 py-2 border ${method === m ? 'bg-violet-600 text-white border-violet-600' : 'border-edge text-slate-300 hover:bg-panel2'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <input value={detail} onChange={(e) => setDetail(e.target.value)}
            placeholder={placeholders[method] ?? 'Details'}
            className="w-full border border-edge rounded-xl px-4 py-2.5 bg-void text-white text-sm" />
          <div className="relative">
            <span className="absolute left-4 top-2.5 text-slate-400">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00" inputMode="decimal"
              className="w-full border border-edge rounded-xl pl-8 pr-4 py-2.5 bg-void text-white" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <p className="text-xs text-amber-300/90">
            Simulated — no real {mode === 'deposit' ? 'money arrives' : 'money leaves'}. It only changes your demo balance.
          </p>
          <button onClick={submit}
            className={`w-full font-bold rounded-xl py-3 text-white ${mode === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'}`}>
            {mode === 'deposit' ? <><Plus size={16} className="inline mr-1" /> Add demo funds</> : 'Send demo funds'}
          </button>
        </div>
      </div>
    </div>
  );
}
