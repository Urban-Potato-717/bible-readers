# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The line above is load-bearing: this repo runs **Next.js 16.2 / React 19**. APIs and conventions differ from older Next.js. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework code.

## Commands

- `npm run dev` — start the dev server (Next.js)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` + `next/typescript`)

There is no test suite. Verify changes by building and exercising the feature in the browser.

## What this app is

"Bible Readers" — a small private PWA for a fixed group (~8 members) to post daily Bible-reading proofs in a shared chat feed. Missing a day incurs an automated 1,000-won fine; an admin marks fines paid. Korean-language UI.

## Architecture

Next.js App Router, all data access server-side through Supabase using the **service_role key only** (RLS is disabled on every table — never expose this key to the client). State lives in Supabase Postgres + Storage; there is no client-side data layer beyond `fetch` to the app's own API routes.

### Auth (`lib/auth.ts`)
Custom cookie sessions, **not** Supabase Auth. Login is name + 4-digit PIN (`app/api/auth/login`); a null `pin_hash` means first login sets the PIN (bcrypt). The session cookie (`bible_session`) is an HMAC-signed user id (`SESSION_SECRET`), verified with `timingSafeEqual`. `getSessionUser()` is the gate used by every protected route/page; `app/(app)/layout.tsx` redirects to `/login` when absent.

### The KST date model (`lib/dates.ts`) — read this before touching fines or verifications
Everything is keyed on a KST (UTC+9) "reading date" with a **1 AM cutoff**: a verification posted between 00:00–01:00 KST counts for the *previous* day. `currentReadingDate()` is the day a new verification applies to; `yesterdayKst()` is what the fine cron assesses. Get this wrong and fines/calendar drift by a day.

### Fines lifecycle
1. Cron `/api/cron/assess-fines` (daily KST 1 AM) inserts a `pending` fine (1,000) for each user with no verification for `yesterdayKst()`. Idempotent via `unique (user_id, date)` and a pre-check.
2. Posting a verification (`/api/verify`) auto-deletes that day's `pending` fine.
3. Admin marks fines `paid` (`/api/admin/mark-paid`) or marks a missed day verified to clear its fine (`/api/admin/mark-verified`).
4. `users.legacy_paid_total` holds pre-app paid amounts folded into totals.

### Chat feed (`lib/messages.ts`, `lib/chat.ts`)
One shared `messages` feed. A row is `kind='chat'` (normal, `date` null) or `kind='verification'` (the daily proof copy, `date` = reading date). **Verifications are written to BOTH `verifications` (source of truth for fines/calendar) and `messages` (feed copy)** — `/api/verify` keeps them in sync, one verification message per user per day. Only `kind='chat'` messages are user-deletable. Feed loads via keyset pagination on `created_at` (`before` = older page, `after` = polling for newer); client polls. Reactions toggle per (message, user, emoji).

### Photos & Storage
Single private bucket `verifications` (constant in `lib/supabase.ts`) holds both verification and chat photos under different path prefixes. Uploads are validated against `ALLOWED_IMAGE_TYPES` (raster only — **SVG is intentionally excluded** because signed URLs open directly in the browser). Reads use signed URLs, cached in-process across requests (`signedCache`) so polling doesn't re-sign every photo. Cron `/api/cron/cleanup-photos` (daily KST 2 AM) deletes photos older than `PHOTO_RETENTION_DAYS` (30) and prunes `chat` messages older than `CHAT_RETENTION_DAYS` (90).

### Web Push (`lib/push.ts`)
VAPID web-push. Devices register subscriptions (`push_subscriptions`, many per user). `sendToUsers()` is fire-and-forget and never throws — callers (e.g. verify notifying other members) must not fail on push errors. Expired subs (404/410) are auto-pruned. Service worker / opt-in in `app/pwa.tsx`, `app/push-optin.tsx`.

### Cron security
All `/api/cron/*` routes call `assertCronAuth()` (`lib/cron.ts`), which requires `Authorization: Bearer ${CRON_SECRET}`. Schedules are in `vercel.json` (cron times are **UTC**: `0 16` = 1 AM KST, `0 17` = 2 AM KST). Routes set `preferredRegion = "icn1"` (Seoul).

## Database

Schema is hand-applied SQL in `supabase/` (run in order in the Supabase SQL Editor; no migration tooling):
`schema.sql` (users, verifications, fines, storage bucket) → `seed.sql` (the fixed members) → `02_chat.sql` (messages, reactions) → `03_push.sql` (push_subscriptions). RLS is disabled on every table by design.

## Environment

Copy `.env.example` to `.env.local`. Required: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (≥16 chars, enforced), `CRON_SECRET`, and VAPID keys (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). Generate VAPID keys with `npx web-push generate-vapid-keys`.

## Conventions

- Path alias `@/*` maps to the repo root.
- Inline code comments are mixed Korean/English; UI strings and user-facing error messages are Korean.
- `getSessionUser()` is the single auth choke point — reuse it, don't re-implement cookie parsing.
