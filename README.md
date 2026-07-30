# RideMS — Microservices Ride Booking System

A backend microservices architecture for a ride-booking platform, built with Node.js, Express, MongoDB, and RabbitMQ. Includes a React frontend with real-time ride dispatching, OpenStreetMap integration, and vehicle-based fare calculation — all without any paid APIs.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  React Frontend                  │
│          localhost:5173 (Vite dev server)        │
└──────────────────────┬──────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────┐
│              API Gateway  :3000                  │
│         (express-http-proxy router)              │
└────────┬──────────────┬──────────────┬──────────┘
         │              │              │
    /user/*        /captain/*      /ride/*
         │              │              │
         ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ User Service │ │Captain Service│ │ Ride Service │
│    :3001     │ │    :3002     │ │    :3003     │
└──────────────┘ └──────┬───────┘ └──────┬───────┘
                        │                │
                        └───────┬────────┘
                                │ AMQP
                         ┌──────▼──────┐
                         │  RabbitMQ   │
                         │ (CloudAMQP) │
                         └─────────────┘
```

### RabbitMQ message flow

```
User books ride
      │
      ▼
Ride Service ──[new-ride queue]──► Captain Service ──► Captain sees ride popup
                                                                │
                                                    Captain clicks Accept
                                                                │
                                                                ▼
User Service ◄──[ride-accepted queue]───────────────────────────
      │
      ▼
User sees "Captain on the way!"
```

---

## Services

| Service | Port | Database | Responsibility |
|---|---|---|---|
| **Gateway** | 3000 | None | Routes all requests to correct service |
| **User** | 3001 | Ride-user-service | Auth, profile, ride acceptance polling |
| **Captain** | 3002 | Ride-captain-service | Auth, availability, ride request dispatch |
| **Ride** | 3003 | Ride-ride-service | Fare calculation, ride lifecycle |
| **Frontend** | 5173 | None | React UI with Leaflet maps |

---

## Tech Stack

### Backend (all services)
| Package | Purpose |
|---|---|
| Express.js | HTTP server and routing |
| Mongoose | MongoDB ODM |
| amqplib | RabbitMQ AMQP client |
| jsonwebtoken | JWT authentication |
| bcrypt | Password hashing |
| dotenv | Environment config |
| cookie-parser | Cookie handling |
| cors | Cross-origin requests |

### Frontend
| Tool | Purpose |
|---|---|
| React 18 + Vite | UI framework and build tool |
| Leaflet (CDN) | Interactive map — no npm install |
| Nominatim (OpenStreetMap) | Address autocomplete — free, no API key |
| OSRM | Distance/duration routing — free, no API key |

---

## Project Structure

```
micro-services/
├── gateway/
│   ├── app.js
│   └── package.json
├── user/
│   ├── controllers/user.controller.js
│   ├── middleware/authMiddleWare.js
│   ├── models/
│   │   ├── user.model.js
│   │   └── blacklisttoken.model.js
│   ├── routes/user.routes.js
│   ├── service/rabbit.js
│   ├── db/db.js
│   ├── app.js
│   └── server.js           ← port 3001
├── captain/
│   ├── controllers/captain.controller.js
│   ├── middleware/authMiddleWare.js
│   ├── models/
│   │   ├── captain.model.js
│   │   └── blacklisttoken.model.js
│   ├── routes/captain.routes.js
│   ├── service/rabbit.js
│   ├── db/db.js
│   ├── app.js
│   └── server.js           ← port 3002
├── ride/
│   ├── controller/ride.controller.js
│   ├── middleware/auth.middleware.js
│   ├── models/ride.model.js
│   ├── routes/ride.routes.js
│   ├── service/rabbit.js
│   ├── db/db.js
│   ├── app.js
│   └── server.js           ← port 3003
└── frontend/
    └── src/
        └── App.jsx
```

---

## Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2) — this is the only supported way to run the project now
- No Google Maps key, no paid APIs needed
- MongoDB and RabbitMQ run as containers (`mongo:7`, `rabbitmq:3.13-management-alpine`) — no Atlas/CloudAMQP account required for local dev

---

## Setup (Docker — recommended)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/micro-services.git
cd micro-services
```

### 2. Create the root `.env`

Only one `.env` file is needed, at the repo root (next to `docker-compose.yml`):

```bash
cp .env.example .env
```

Fill in:
```env
JWT_SECRET=some-long-random-string
```
(`AWS_ACCOUNT_ID` / `AWS_REGION` are only needed for the AWS deploy scripts in `aws/`, not for local Docker.)

> The `user/.env`, `captain/.env`, `ride/.env` files (if present) are **dev-only, non-Docker leftovers** — see [Do the per-service `.env` files matter?](#do-the-per-service-env-files-matter) below. Docker never reads them.

### 3. Start everything

**Development** (hot-reload via nodemon/Vite, source mounted into containers):
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```
- Frontend: http://localhost:5173 (Vite dev server, HMR)
- Gateway: http://localhost:3000
- RabbitMQ management UI: http://localhost:15672 (guest/guest)
- Mongo: localhost:27017

**Production-like local run** (built nginx frontend, no source mounts):
```bash
docker compose up --build
```
- Frontend: http://localhost:5173 (static build served by nginx)
- Gateway: http://localhost:3000

Stop with `docker compose down` (add `-v` to also wipe the Mongo volume).

### 4. Verify it's working

```bash
curl http://localhost:3000/health          # gateway
curl -X POST http://localhost:3000/user/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"Test1234!"}'
```
A `200` with a JWT `token` back means gateway → user service → Mongo → RabbitMQ are all wired correctly (this was verified against a live run of this exact compose setup).

---

## Do the per-service `.env` files matter?

**No — and they won't conflict.** Two independent things keep them harmless:

1. Every service's `.dockerignore` excludes `.env` and `.env.*` from the build context, so those files are **never copied into the image** in the first place.
2. Even where `dotenv.config()` runs in code, `dotenv` **never overwrites a variable that's already set** in `process.env`. Docker Compose injects `MONGO_URL`, `RABBIT_URL`, `JWT_SECRET`, etc. directly as container environment variables (see `docker-compose.yml`), so those always win.

So if `user/.env`, `captain/.env`, or `ride/.env` still contain an old MongoDB Atlas / CloudAMQP URI from a previous non-Docker copy of this project, it is simply dead weight inside the container — Docker Compose's `mongodb://mongo:27017/...` and `amqp://guest:guest@rabbitmq:5672` always take precedence. You don't need to delete or edit them for Docker to work, though you can delete them if you no longer run the services with plain `node server.js`.

The only place a "real" Mongo URI matters is production: `docker-compose.prod.yml` currently points at the bundled `mongo` container too. For a managed database (Atlas, DocumentDB, etc.) in production, override `MONGO_URL` per service via a prod env file or Secrets Manager (the `aws/create-secrets.sh` script already does this for the ECS path) rather than editing the service `.env` files.

---

## Manual / non-Docker setup (legacy, not recommended)

<details>
<summary>Expand for the old MongoDB Atlas + CloudAMQP + 5-terminal workflow</summary>

### 1. Set up MongoDB Atlas

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) and create a free M0 cluster
2. Create a database user under **Security → Database Access**
3. Allow network access under **Security → Network Access → Allow from anywhere**
4. Get your connection string: **Connect → Drivers**

You need 3 databases — all on the same cluster, just different names in the URL:
```
.../Ride-user-service?...
.../Ride-captain-service?...
.../Ride-ride-service?...
```
Atlas creates each database automatically on first write.

### 2. Set up RabbitMQ

1. Go to [cloudamqp.com](https://www.cloudamqp.com) and sign up
2. Create a free **Little Lemur** instance
3. Copy the **AMQP URL** (starts with `amqps://`)

### 3. Install dependencies

```bash
cd gateway  && npm install && cd ..
cd user     && npm install && cd ..
cd captain  && npm install && cd ..
cd ride     && npm install && cd ..
cd frontend && npm install && cd ..
```

### 4. Create .env files

**`user/.env`**
```env
JWT_SECRET=user_secret
MONGO_URL=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/Ride-user-service?appName=Cluster0
RABBIT_URL=amqps://your:credentials@your.cloudamqp.url/vhost
```

**`captain/.env`**
```env
JWT_SECRET=user_secret
MONGO_URL=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/Ride-captain-service?appName=Cluster0
RABBIT_URL=amqps://your:credentials@your.cloudamqp.url/vhost
```

**`ride/.env`**
```env
JWT_SECRET=user_secret
MONGO_URL=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/Ride-ride-service?appName=Cluster0
BASE_URL=http://localhost:3001
RABBIT_URL=amqps://your:credentials@your.cloudamqp.url/vhost
```

> ⚠️ `JWT_SECRET` must be **identical** in all three services — tokens created by one service are verified by another.

### 5. Start all services

Open **5 terminals**. Start in this order and wait for `Connected to DB` before moving to the next:

```bash
# Terminal 1
cd user && node server.js

# Terminal 2
cd captain && node server.js

# Terminal 3
cd ride && node server.js

# Terminal 4 — start AFTER all 3 services are up
cd gateway && node app.js

# Terminal 5
cd frontend && npm run dev
```

</details>

---

## Deploying to production

Two options are already wired up in this repo:

- **`docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build`** on a single VM/host — set `PUBLIC_HOST` and `JWT_SECRET` in the root `.env`, put a reverse proxy/TLS terminator (e.g. Caddy, nginx, Traefik) in front of ports 80/3000 if exposing publicly.
- **AWS ECS Fargate** — full pipeline already implemented in `aws/` (ECR, Secrets Manager, IAM, task definitions) and `.github/workflows/deploy.yml` (build/push/deploy on every push to `main` via OIDC). See `aws/README.md` for the one-time setup steps.

---

## Testing the Full Ride Flow

Open **two browser windows** side by side.

**Window 1 — Rider**
1. Go to `http://localhost:5173` → Switch to Rider → Sign up → Log in
2. Type a pickup location → pick from autocomplete dropdown (pin appears on map)
3. Type a destination → pick from autocomplete (second pin + dashed route line appears)
4. Click **See fares** → three vehicle cards show with ₹ fares
5. Select 🚖 Cab / 🛺 Auto / 🏍️ Bike → click **Confirm**

**Window 2 — Captain**
1. Switch to Captain → Sign up (Step 1: details, Step 2: vehicle type + plate + color) → Log in
2. Click **Go Online** → status turns green, "Listening" badge appears
3. Ride request card appears automatically with pickup, destination, and ₹ fare
4. Click **✓ Accept**

Window 1 updates to "🎉 Captain on the way!" — complete end-to-end flow via RabbitMQ.

---

## API Reference

All requests go through the gateway at `http://localhost:3000`.

### User — `/user`

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/user/register` | No | `{ name, email, password }` | Register user |
| POST | `/user/login` | No | `{ email, password }` | Login user |
| GET | `/user/profile` | Bearer | — | Get logged-in user profile |
| GET | `/user/logout` | Bearer | — | Logout and blacklist token |
| GET | `/user/accepted-ride` | Bearer | — | Long-poll: wait for captain to accept |

### Captain — `/captain`

| Method | Endpoint | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/captain/register` | No | `{ name, email, password, vehicle: { type, plate, color } }` | Register captain |
| POST | `/captain/login` | No | `{ email, password }` | Login captain |
| GET | `/captain/profile` | Bearer | — | Get logged-in captain profile |
| GET | `/captain/logout` | Bearer | — | Logout and blacklist token |
| PATCH | `/captain/toggle-availability` | Bearer | — | Toggle online / offline status |
| GET | `/captain/new-ride` | Bearer | — | Long-poll: wait for incoming ride |

### Ride — `/ride`

| Method | Endpoint | Auth | Params / Body | Description |
|---|---|---|---|---|
| GET | `/ride/get-fare` | Bearer | `?pickup=&destination=` | Fare estimate for all vehicle types |
| POST | `/ride/create-ride` | Bearer | `{ pickup, destination, vehicleType }` | Create ride and publish to queue |
| PUT | `/ride/accept-ride` | Bearer (Captain) | `?rideId=` | Accept ride and notify user |

### Vehicle types
`cab` · `auto` · `bike`

### Fare structure (INR)

| Vehicle | Base fare | Per km | Example (5 km) |
|---|---|---|---|
| 🚖 Cab | ₹50 | ₹14/km | ~₹120 |
| 🛺 Auto | ₹30 | ₹9/km | ~₹75 |
| 🏍️ Bike | ₹20 | ₹6/km | ~₹50 |

---

## Key Design Decisions

**Shared JWT secret across services** — tokens are issued by user/captain service and verified by the ride service. All three must use the same `JWT_SECRET`, otherwise cross-service auth returns 401.

**Ride auth middleware uses direct DB connections** — the original code made HTTP calls through the gateway to verify tokens, which caused server-to-server CORS failures. Fixed by opening separate Mongoose connections directly to the user and captain databases from within the ride middleware.

**In-memory ride queue in captain service** — RabbitMQ delivers the `new-ride` message immediately when a ride is created. If no captain is online at that instant, the original code acknowledged and discarded the message. Fixed with an in-memory queue: undelivered rides are stored until a captain polls, then dispatched immediately.

**HTTP long-polling instead of WebSockets** — ride dispatching uses HTTP long-polling (connection held open up to 30s). Simple, stateless, and works through any proxy.

**OpenStreetMap stack** — Nominatim for geocoding and autocomplete, Leaflet loaded from CDN for the interactive map. Zero API keys, zero billing, zero usage restrictions for a development project.

---

## Common Issues

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED` at gateway | A service isn't running | Start all 3 services before starting gateway |
| `401 Unauthorized` on ride | JWT secret mismatch | Set same `JWT_SECRET` in all `.env` files |
| `500` on captain toggle | Wrong JWT secret in captain `.env` | Change to same secret as user service |
| Ride not showing on captain | Old race condition in controller | Replace with the fixed `captain.controller.js` |
| Atlas `ECONNREFUSED` | Cluster paused (60-day inactivity) | Resume cluster from Atlas dashboard |
| RabbitMQ connection refused | CloudAMQP instance paused | Log in to CloudAMQP and resume instance |

---

## Environment Variables Reference

| Variable | Services | Value |
|---|---|---|
| `JWT_SECRET` | user, captain, ride | Any string — must be identical in all three |
| `MONGO_URL` | user, captain, ride | Atlas URI with correct database name suffix |
| `RABBIT_URL` | user, captain, ride | CloudAMQP `amqps://` connection string |
| `BASE_URL` | ride only | `http://localhost:3001` (user service direct) |

---

## License

Built for learning purposes. Free to fork and extend.