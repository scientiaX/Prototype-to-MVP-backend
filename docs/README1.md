# Prototype to MVP - Backend

Backend API untuk platform Prototype to MVP yang menggunakan AI untuk generate masalah bisnis dan mengevaluasi solusi user secara real-time.

## Features

- **AI-Powered Problem Generation**: Generate masalah bisnis real-world dengan Groq AI
- **Solution Evaluation**: Evaluasi solusi user dengan AI mentor
- **Adaptive Learning**: System yang menyesuaikan difficulty berdasarkan performa user
- **Gamification**: XP system, achievements, dan artifacts
- **Profile Calibration**: Kalibrasi profil user untuk personalisasi experience
- **Realtime Arena Guidance**: WebSocket untuk keystroke tracking & intervensi AI
- **Onboarding Arena**: Flow onboarding khusus untuk kalibrasi cepat
- **Exploit & XP Guardrails**: Proteksi eksploit dan pembekuan XP otomatis

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB dengan Mongoose ODM
- **AI Integration**: Groq AI (agent/heavy), Cloudflare Workers AI (realtime/light)
- **Realtime**: WebSocket (`ws`)
- **Authentication**: JWT (ready for implementation)

## Setup

### Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 7.0
- Groq API Key (`AI_API` dan opsional `AI_API2`)
- Cloudflare Account ID + Token (opsional untuk realtime AI)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Update `.env` dengan credentials Anda:
```env
AI_API=your_groq_api_key_here
AI_API2=your_secondary_groq_api_key_here
AI_API_RESPONSE=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
MONGODB_URI=mongodb://localhost:27017/prototype-mvp
JWT_SECRET=your-secure-secret-here
```

4. Start server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

> Detail lengkap tersedia di [API_REFERENCE.md](./API_REFERENCE.md).

### Profiles
- `POST /api/profiles/calibrate` - Kalibrasi profil user baru
- `GET /api/profiles/:user_id` - Get profil user
- `PUT /api/profiles/:user_id` - Update profil user
- `GET /api/profiles` - Get leaderboard

### Problems
- `POST /api/problems/generate` - Generate masalah baru dengan AI
- `GET /api/problems` - Get list masalah
- `GET /api/problems/:problem_id` - Get detail masalah

### Arena
- `POST /api/arena/start` - Mulai arena session
- `POST /api/arena/submit` - Submit solusi dan evaluasi
- `POST /api/arena/abandon` - Abandon session
- `GET /api/arena/user/:user_id` - Get user sessions

### Mentor
- `POST /api/mentor/question` - Generate Socratic question

### Auth
- `POST /api/auth/register` - Registrasi user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Info user dari token

### Entry (Frictionless)
- `GET /api/entry/pure-choices` - Ambil pilihan simbol
- `POST /api/entry/assign-meaning` - Mapping makna dari simbol pilihan
- `POST /api/entry/record-choice` - Catat pilihan user

### Onboarding Arena
- `POST /api/onboarding-arena/generate-problem` - Generate onboarding problem
- `POST /api/onboarding-arena/get-consequence` - Ambil konsekuensi pilihan
- `POST /api/onboarding-arena/complete` - Selesaikan onboarding & kalibrasi profil
- `POST /api/onboarding-arena/init-session` - Mulai session onboarding realtime
- `POST /api/onboarding-arena/track` - Track keystroke onboarding
- `POST /api/onboarding-arena/record-decision` - Catat keputusan onboarding
- `GET /api/onboarding-arena/next-action/:session_id` - Cek intervensi berikutnya
- `POST /api/onboarding-arena/intervention-response` - Respon intervensi

### User Data
- `GET /api/user/achievements/:user_id` - Get achievements
- `GET /api/user/artifacts/:user_id` - Get artifacts

### Admin (Read-only)
- `GET /api/admin/audit-logs/:user_id` - XP audit logs
- `GET /api/admin/audit-summary/:user_id` - Ringkasan XP audit
- `GET /api/admin/exploit-reports` - Laporan exploit
- `GET /api/admin/stagnation-reports` - Laporan stagnasi
- `GET /api/admin/linked-accounts/:user_id` - Akun terkait
- `GET /api/admin/difficulty-baselines` - Baseline difficulty
- `GET /api/admin/system-health` - Health metrics

### WebSocket
- `ws://localhost:3001/ws/arena` - Realtime arena channel (join session, keystroke, hint, intervention)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3001` |
| `AI_API` | Groq API key utama | Optional (wajib untuk AI agent) |
| `AI_API2` | Groq API key cadangan | Optional |
| `AI_API_RESPONSE` | Cloudflare Workers AI token | Optional (realtime AI) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id | Optional (realtime AI) |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/prototype-mvp` |
| `JWT_SECRET` | JWT signing secret | Required |
| `CORS_ORIGIN` | CORS allowed origin | `http://localhost:5173` |

## AI Integration (3-Layer)

Project ini menggunakan 3 layer AI sesuai beban kerja:

### Layer 1 - Realtime (Cloudflare Workers AI)
- Dipakai di `aiRealtimeService` dan `aiSimpleService`
- Butuh `AI_API_RESPONSE` + `CLOUDFLARE_ACCOUNT_ID`
- Jika tidak dikonfigurasi, sistem pakai template respons

### Layer 2/3 - Heavy & Agent (Groq)
- Dipakai di `aiService` untuk generate problem & evaluasi
- Butuh `AI_API` (opsional `AI_API2` untuk rotasi kunci)

### Catatan
- `src/config/openai.js` masih ada untuk kompatibilitas lama, namun deprecated dan tidak digunakan dalam flow utama.

## Docker Deployment

Build dan run dengan Docker:

```bash
docker build -t prototype-mvp-backend .
docker run -p 3001:3001 --env-file .env prototype-mvp-backend
```

Atau gunakan docker-compose (dari root project):

```bash
docker-compose up -d
```

## Project Structure

```
backend-structure/
├── src/
│   ├── config/
│   │   ├── database.js      # MongoDB connection
│   │   ├── cloudflareAI.js  # Realtime AI (Cloudflare)
│   │   ├── groqAI.js        # Heavy AI (Groq)
│   │   ├── googleAI.js      # Opsional (Gemini)
│   │   └── openai.js        # Deprecated (legacy)
│   ├── models/
│   │   ├── User.js              # User auth schema
│   │   ├── UserProfile.js       # User profile schema
│   │   ├── Problem.js           # Problem schema
│   │   ├── ArenaSession.js      # Session schema
│   │   ├── ArenaSessionMetrics.js # Metrics schema
│   │   ├── Achievement.js       # Achievement schema
│   │   ├── Artifact.js          # Artifact schema
│   │   ├── DifficultyBaseline.js # Difficulty schema
│   │   ├── ResponseHistory.js   # Response logs
│   │   ├── SessionMemory.js     # Realtime session memory
│   │   └── XPAuditLog.js        # XP audit logs
│   ├── routes/
│   │   ├── profileRoutes.js
│   │   ├── problemRoutes.js
│   │   ├── arenaRoutes.js
│   │   ├── mentorRoutes.js
│   │   ├── userDataRoutes.js
│   │   ├── authRoutes.js
│   │   ├── entryRoutes.js
│   │   ├── adminRoutes.js
│   │   └── onboardingArenaRoutes.js
│   ├── services/
│   │   ├── aiService.js         # AI integration (heavy)
│   │   ├── aiRealtimeService.js # Realtime nudges
│   │   ├── aiSimpleService.js   # Simple prompts
│   │   ├── orchestratorService.js # Websocket orchestrator
│   │   ├── websocketService.js  # WebSocket server
│   │   ├── exploitDetectionService.js # Exploit guard
│   │   ├── xpGuardService.js    # XP validation
│   │   └── profileService.js    # Profile calculation
│   └── server.js            # Main server file
├── .env.example
├── package.json
└── Dockerfile
```

## Development

```bash
# Install dependencies
npm install

# Run development server with auto-reload
npm run dev

# Run tests
npm test
```

## License

Proprietary
