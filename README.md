# 🚨 GeoSOS — AI-Driven Emergency Response Platform

Real-time emergency response system that connects victims with the nearest capable volunteers using geospatial filtering, multi-criteria KNN responder ranking, and live GPS tracking — backed by Gemini AI for triage and first-aid guidance.

**Stack**: React 19 · Node.js/Express · MongoDB Atlas · Socket.io · Leaflet · Google Gemini 2.5 Flash

[Watch the demo](https://youtu.be/-xW9SEcwGR4) *(2x speed recommended)*

---

## Why GeoSOS

Ambulances aren't always available, and most volunteer-alert systems just ping everyone in a radius regardless of fit. GeoSOS instead narrows candidates geospatially, then ranks them by proximity, prior rescue experience, and skill match — so the volunteers who actually get notified are the ones most likely to help, fast.

---

## Features

### Emergency Dispatch & Matching
- **Two-stage responder selection**:
  - **Stage 1 — Geospatial retrieval**: MongoDB `2dsphere` indexing fetches a candidate pool within an expanding search radius (500m → 1km → 5km → 10km).
  - **Stage 2 — Multi-criteria ranking**: Candidates are scored on normalized distance, prior rescue experience, and skill match to select the top 5 responders.
- Both victims and volunteers can trigger emergency SOS calls.
- Intelligent radius escalation when no volunteer responds in time.
- Emergency contacts fallback if volunteers remain unreachable.

### AI Triage & Real-Time Communication
- **Gemini 2.5 AI assistant**: Real-time severity assessment, first-aid instructions, and safety precautions.
- **Multi-language guidance**: English, Hindi, Kannada.
- **Voice emergency input**: Speech Recognition API for hands-free reporting.
- **Real-time WebSockets**: Socket.io room isolation (`user_${id}`, `sos_${id}`) for live GPS tracking and two-way chat.

### For Victims
- One-tap SOS trigger across 6 categories: Medical, Accident, Fire, Assault, Natural Disaster, Other.
- Live map showing the responding volunteer's location and ETA.
- Nearby hospital recommendations with navigation.
- One-tap emergency call with country-specific number detection.
- **Installable PWA**: Works offline.
- Full SOS history log.

### For Volunteers
- Real-time SOS alerts scoped to the current search radius.
- Distance shown before accepting a request.
- Turn-by-turn navigation to the victim.
- Rescue history and stats.

### Load Balancing & High Availability
- **Multi-core process cluster (`backend/cluster.js`)**: Spawns parallel workers across all available CPU cores with automatic crash recovery.
- **Port sharing with round-robin load distribution**: Run via `npm run cluster`.

### Security & Privacy
- **JWT authentication**: Stateless tokens across REST APIs and Socket handshakes.
- **Dedicated rate limiters**: Protects auth, SOS creation, and general endpoints against brute-force and DoS.
- **Helmet.js security headers**: XSS, HSTS, clickjacking, and MIME-sniffing protection.
- Phone OTP verification for account access.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite, Tailwind CSS, Leaflet Maps, vite-plugin-pwa |
| **Backend** | Node.js, Express.js, cluster load balancer, express-rate-limit |
| **Database** | MongoDB Atlas, 2dsphere geospatial indexing |
| **Real-time** | Socket.io (WebSocket room isolation) |
| **AI** | Google Gemini 2.5 Flash |
| **Auth** | JWT + Phone OTP |
| **PWA** | Service Worker, Workbox |

---

## Getting Started

**Prerequisites**: Node.js v18+, a MongoDB Atlas cluster, a Google Gemini API key.

```bash
# Backend
cd backend
npm install
cp .env.example .env # fill in MongoDB URI, JWT secret, Gemini API key
npm run dev          # single-worker development mode
# OR
npm run cluster      # multi-core load-balanced cluster mode

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev
```

*The frontend expects the backend running locally per your `.env` configuration — check `frontend/src/services/api.js` for the base URL if you change ports.*

---

## Project Structure

```text
sos-platform/
├── backend/
│   ├── cluster.js       # Multi-core load balancer & worker crash recovery
│   ├── server.js        # Express API server & Socket.io setup
│   ├── models/          # User, SOSRequest, Message schemas
│   ├── routes/          # auth, sos, users, volunteers, messages
│   ├── middleware/      # JWT auth & role-based permissions
│   └── socket/          # Socket.io event handlers
│
└── frontend/
    └── src/
        ├── pages/       # Home, Victim, Volunteer
        ├── components/  # SOSMap, AIAssistant, ChatBox
        ├── context/     # AuthContext (user, token, socket state)
        └── services/    # api.js — Axios client
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/send-otp` | Send OTP to a phone number |
| POST | `/api/auth/verify-otp` | Verify OTP and log in |
| GET | `/api/auth/me` | Get the current authenticated user |

### SOS
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/sos` | Create an SOS request, triggers intelligent escalation |
| GET | `/api/sos` | Get active SOS requests |
| GET | `/api/sos/public` | Public activity log |
| GET | `/api/sos/history` | Past SOS requests |
| PUT | `/api/sos/:id/accept` | Volunteer accepts an SOS |
| PUT | `/api/sos/:id/complete` | Mark a rescue complete |
| PUT | `/api/sos/:id/cancel` | Cancel an SOS |
| POST | `/api/sos/:id/emergency-call` | Log an emergency services call |
| GET | `/api/sos/emergency-numbers` | Country-specific emergency numbers |
| GET | `/api/sos/nearby-hospitals` | Nearby hospitals by location |

### Messages
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/messages/:sosId` | Fetch chat messages for an SOS |
| POST | `/api/messages` | Send a message |

### Volunteers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/volunteers/nearby` | Get nearby available volunteers |
| PUT | `/api/volunteers/location` | Update live location |
| PUT | `/api/volunteers/availability` | Toggle available/busy |

---

## Socket.io Events

| Event | Direction | Description |
|---|---|---|
| `new_sos_request` | Server → Volunteer | New SOS within range |
| `sos_accepted` | Server → Victim | A volunteer accepted |
| `sos_completed` | Server → Victim | Rescue marked complete |
| `sos_cancelled` | Server → Volunteer | Victim cancelled the request |
| `emergency_services_called` | Server → Victim | Emergency call logged |
| `emergency_contacts_notified` | Server → Victim | Fallback contacts notified |
| `new_message` | Server → Both | New chat message |
| `victim_location_update` | Server → Volunteer | Victim's position updated |
| `volunteer_location_update` | Server → Victim | Volunteer's position updated |
| `update_location` | Client → Server | Push current location |
| `join_sos_room` | Client → Server | Join the SOS chat room |

---

## License

MIT — free to use for educational and research purposes.
