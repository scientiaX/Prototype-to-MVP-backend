# API Reference (Backend)

Dokumentasi ini merangkum endpoint REST dan WebSocket yang tersedia di backend saat ini.

## Base URL

- Local: `http://localhost:3001`
- Health check: `GET /health`
- Root info: `GET /`

---

## Auth

- `POST /api/auth/register` — Registrasi user baru.
- `POST /api/auth/login` — Login dan dapatkan JWT.
- `GET /api/auth/me` — Ambil data user dari token (Bearer).

## Profiles

- `POST /api/profiles/calibrate` — Kalibrasi profil user.
- `GET /api/profiles/:user_id` — Ambil profil user.
- `PUT /api/profiles/:user_id` — Update profil user.
- `GET /api/profiles` — Leaderboard (sorted by total XP).

## Problems

- `POST /api/problems/generate` — Generate problem personalisasi.
- `GET /api/problems` — List problem dengan filter query.
- `GET /api/problems/:problem_id` — Detail problem.

## Arena

- `POST /api/arena/start` — Mulai arena session.
- `POST /api/arena/submit` — Submit solusi & evaluasi.
- `POST /api/arena/abandon` — Abandon session.
- `GET /api/arena/user/:user_id` — Riwayat session user.
- `GET /api/arena/monthly-indicator/:user_id` — Progress arena bulanan.

### Arena Realtime (HTTP polling)

- `POST /api/arena/init-session` — Inisialisasi orchestrator session.
- `POST /api/arena/track` — Track keystroke.
- `GET /api/arena/next-action/:session_id` — Ambil action berikutnya.
- `POST /api/arena/intervention-response` — Respon intervensi.
- `GET /api/arena/metrics/:session_id` — Metrics & memory (debug/analytics).

### Arena Entry Flow

- `POST /api/arena/entry/generate-choices` — Generate pilihan forced-choice.
- `POST /api/arena/entry/generate-consequence` — Generate konsekuensi pilihan.

## Mentor

- `POST /api/mentor/question` — Generate Socratic question.

## User Data

- `GET /api/user/achievements/:user_id` — List achievements.
- `GET /api/user/artifacts/:user_id` — List artifacts.

## Entry (Frictionless)

- `GET /api/entry/pure-choices` — Ambil simbol pilihan.
- `POST /api/entry/assign-meaning` — Mapping makna pilihan.
- `POST /api/entry/record-choice` — Catat pilihan user.

## Onboarding Arena

- `POST /api/onboarding-arena/generate-problem` — Generate onboarding problem.
- `POST /api/onboarding-arena/get-consequence` — Consequence pilihan.
- `POST /api/onboarding-arena/complete` — Selesaikan onboarding & kalibrasi profil.
- `POST /api/onboarding-arena/init-session` — Init session realtime.
- `POST /api/onboarding-arena/track` — Track keystroke.
- `POST /api/onboarding-arena/record-decision` — Catat keputusan.
- `GET /api/onboarding-arena/next-action/:session_id` — Cek intervensi.
- `POST /api/onboarding-arena/intervention-response` — Respon intervensi.

## Admin (Read-only)

- `GET /api/admin/audit-logs/:user_id` — XP audit logs.
- `GET /api/admin/audit-summary/:user_id` — Ringkasan audit.
- `GET /api/admin/exploit-reports` — Laporan exploit.
- `GET /api/admin/stagnation-reports` — Laporan stagnasi.
- `GET /api/admin/linked-accounts/:user_id` — Akun terkait.
- `GET /api/admin/difficulty-baselines` — Baseline difficulty.
- `GET /api/admin/system-health` — Health metrics.

### Admin (Blocked)

Endpoint berikut **selalu** mengembalikan `403`:

- `POST /api/admin/inject-xp`
- `PUT /api/admin/modify-xp/:user_id`
- `DELETE /api/admin/reset-xp/:user_id`

---

## WebSocket (`/ws/arena`)

**URL:** `ws://localhost:3001/ws/arena`

### Incoming message types

- `join_session` — `{ type: 'join_session', session_id }`
- `keystroke` — `{ type: 'keystroke', data }`
- `user_response` — `{ type: 'user_response', response, time_elapsed }`
- `intervention_response` — `{ type: 'intervention_response', response_type }`
- `request_hint` — `{ type: 'request_hint', partial_answer? }`
- `ping` — `{ type: 'ping' }`

### Outgoing message types

- `session_joined`
- `ai_action`
- `response_processed`
- `intervention_result`
- `hint`
- `pong`
- `error`

> Catatan: Semua pesan berbentuk JSON dan dikirim per-session.
