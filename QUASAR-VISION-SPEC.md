# QUASAR — अगला बड़ा अपडेट (Vision Spec)

> Source: Sandeep ne 2026-10-13 ko paste kiya (doosre AI se bana spec).
> Note: Doosre AI ke paas codebase nahi tha — lekin Jinny ke paas FULL Quasar codebase
> ~/workspace/quasar/ me already hai. ZIP upload ki zaroorat nahi.

## Vision
QUASAR ko ab keval ek trading dashboard nahi, balki AI-Powered Global Trading,
Strategy Testing, Copy Trading aur Paper Trading Platform ke roop me update karna.
User register kare, demo balance paaye, alag-alag strategies test kare,
copy trading seekhe, AI chatbot se jawab le aur har trade ka poora hisaab dekhe.

Paper trading ka anubhav vaastavik jaisa hoga, lekin shuruati sanskaran me
order, profit, loss, commission aur wallet balance SIMULATED honge.

## 1. Universal Strategy Hub
- Sabhi trading programs aur strategies ek jagah.
- Har strategy ko Copy Trading, Strategy Tester aur Grid Board me istemal karna.
- Scalping, intraday, swing, grid, trend-following aur AI-assisted strategies.
- Har strategy ka alag risk score, performance, drawdown aur trade history.

## 2. Smart Strategy Tester 2.0
- Desh, exchange, instrument aur timeframe ke anusaar testing.
- Historical backtest, out-of-sample test aur paper-trading forward test.
- Brokerage, spread, slippage, commissions aur laagu taxes shamil.
- Win rate, profit factor, net P&L, max drawdown aur benchmark comparison.
- Results save karke do strategies ki tulna.

## 3. Grid Board 2.0
- Grid levels, buy/sell orders aur price range ka live-style visualization.
- Arithmetic aur geometric grids, adaptive grid tatha range-bound strategy testing.
- Anumanit fees, inventory, floating P&L aur total net P&L.
- Stop conditions, maximum exposure aur market-trend badalne par alerts.

## 4. QUASAR AI Copilot
- Strategies, trading rules, tester results, fees aur wallet ki jaankari par aadharit jawab.
- User pooch sake: "aaj mujhe kitna profit hua?", "meri kaun-si strategy behtar hai?", "commission kahan kat raha hai?"
- Uplabdh platform data se jawab aur sambandhit trade/strategy ka sandarbh.
- Data uplabdh na ho to spasht bataye ki jaankari nahi mili; mangadhant jawab nahi.

## 5. Copy Trading — sabhi strategies ke saath
- Sabhi QUASAR programs ki strategy library.
- Strategy chunkar use apne demo account me copy karna.
- Fixed amount ya balance ka pratishat aavantit karna.
- Risk multiplier, stop-loss aur maximum daily loss set karna.
- Source strategy aur copied portfolio ke alag-alag parinaam.
- Pause, resume aur stop-copy vikalp.
- Har copied trade ke saath entry, exit, fees aur net P&L.
- Purana pradarshan bhavishya ke munafe ki guarantee NAHI hoga.

## 6. Paper Trading Wallet aur poora hisaab (DEMO)
- $100,000.00 prarambhik simulated balance (configurable).
- Today's gross profit, trading losses, commission + fees, net trading P&L.
- Available demo balance aur reserved funds.
- Realized P&L aur unrealized P&L.
- Pratyek trade par brokerage, exchange fee aur anya charges.
- GST ya anya laagu karon ka alag vivaran (simulated market rules ke anusaar).
- Daily, weekly, monthly aur lifetime performance.
- Deposit/refill, trade execution aur fee deductions ki transaction history.
- IMPORTANT: Bharat ke GST aur Canada ke kar niyam ek jaise nahi — country, exchange,
  instrument ke anusaar tax configuration. Demo me kar ANUMAN ke roop me; vaastavik
  tax calculation ya payment NAHI.

## 7. Auto Trading aur Scalping
- Auto Start/Stop (nirdharit samay par).
- 24/7 Crypto monitoring.
- Market Schedule (desh, exchange, timezone ke anusaar).
- Scalping Mode (chhote timeframes par tez entry/exit signals test).
- Strategy Selection (Grid, scalping, trend, anya).
- Risk Guard (daily loss, exposure, position limits).
- Emergency Stop (sabhi nayi simulated entries rokna).
- Activity Log (har signal, order, rejection, fee ka record).
- Stock exchanges ke trading hours aur holidays ka samman. Auto Trading ko
  server-side scheduler + background execution se chalana chahiye (mobile app
  band hone par bhi demo simulation jaari).

## 8. Registration — Demo Mode ko saral banana
- Step 1: Name + email.
- Step 2: Demo verification — koi vaastavik email na bhejein. Demo OTP screen par
  spasht roop se simulated verification bataye.
- Step 3: Demo wallet banaye (alag demo identity, wallet, initial balance).
- Step 4: Paper trading shuru (refill, backtest, copy, auto-trading simulation).
- Demo me nirdharit test code sweekar ya dikhaya gaya demo code istemal.
  Production account ke liye alag, surakshit verification.

## 9. Chatbot ko vaastav me jawab dene wala banana
- Backend tools + database se jodna (sirf design badalne se nahi hoga).
- Kam-se-kam in data sroton tak niyantrit pahunch: strategies + parameters,
  backtest/Grid results, copy-trading positions + logs, wallet/ledger/commission/tax,
  user settings/schedule/risk limits.
- Tool-based QA, error handling, conversation history, permission checks.
- Chatbot ko kisi doosre user ka wallet ya niji data NAHI dikhana.

## 10. Banane ka sahi kram (Phases)
- Phase 1 — Core demo system: Registration, persistent user accounts, demo wallet,
  refill aur transaction ledger.
- Phase 2 — Strategy engine: ek sajha strategy registry (Tester, Grid, Copy, Auto
  ek hi definition istemal karen).
- Phase 3 — Realistic simulator: Historical data, spread, slippage, fees,
  position sizing, daily reports.
- Phase 4 — AI Copilot: Database-backed chatbot, strategy explanations,
  wallet questions, test-result analysis.
- Phase 5 — Automated demo execution: Scheduler, 24/7 crypto simulation,
  scalping mode, stop conditions, audit logs.
- Phase 6 — Verification: Persistence, calculations, access control,
  reconnect/restart behavior, end-to-end tests.

## Pehli prathamikta (spec ke anusaar)
Demo registration + persistent wallet + sabhi strategies ka sajha engine +
jawab dene wala AI chatbot. Uske baad Grid Board, Tester, Copy, 24/7 Auto
Trading ko usi engine par ekikrit karen.

## Status (Jinny, 2026-10-13)
- Pine Scripts collected so far: 6 (01 TrendCraft, 02 Q-Trend, 03 Breakout Targets,
  04 UT Bot, 05 SMC LuxAlgo, 06 Supertrend-Sandeep) — sabhi me QUASAR header added.
- Copy Trading: 6 → 12 fictional traders (local, unreleased).
- Register/Account: 3 fixes (existing-user message, input visibility, account redirect).
- Pending Sandeep: baaki ~14 Pine Scripts paste karna.
- Build rule: sab kuch ek saath ek package me (uske "all together at once" ke anusaar).
