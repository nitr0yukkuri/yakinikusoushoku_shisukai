# Matsun-ya (待つん屋)

[日本語](README.md) | [English](README.en.md)

> A meetup app designed around the person waiting.

**Created:** May 22, 2026  
**Team:** Yakiniku Shokushoku

---

## Overview

An app that reduces the stress of waiting by showing the other person’s estimated arrival time and nearby places to spend time.

---

## Background and current problem

People often get frustrated while waiting for someone who is late.

- Few systems focus on the stress of the person who is waiting.
- As a result, there are few approaches to easing the waiting person’s stress.

---

## Why waiting is frustrating

- Without an update, you do not know where the other person is or when they will arrive.
- You can only wait, which feels boring and like your time is being taken away.
- If you do something else before the late person arrives, coordinating and meeting up can become difficult.
- Waiting is especially stressful when you do not know when it will end.

---

## Proposed solution

- If someone cannot make the meetup time, let the other person see their location and estimated arrival time.
- Share the waiting person’s location too, so they can move around and still meet easily.
- Suggest nearby places to spend time while waiting.
- Show arrival times with a buffer to reduce the chance of the other person arriving later than estimated.

---

## Differentiation

- The app does not punish people who are late; blaming them could make lateness more frequent.
- It does more than share locations: it uses the information to estimate arrival times and suggest nearby places.
- Send a reminder the day before to turn on location sharing.

---

## Tech stack

### Frontend

- **React Native** — cross-platform support for iOS and Android

### Backend

- **Go** — API server
- **WebSocket** — real-time two-way communication with the frontend

### Database

- **PostgreSQL** — primary database
- **Neon** — serverless PostgreSQL hosting
- **PostGIS** — management and queries for location data

### External APIs

- **Google Maps API** — map display, route calculation, and nearby place searches

### Deployment

- **Render** or **Google Cloud Run** — backend hosting

---

## Main features

### Meetup management

- Create and join meetups (invite through a room code or link)
- Set the meetup time and location

### Real-time location sharing

- Show the late person’s current location on a map in real time
- Share the waiting person’s location too, helping both sides meet up
- Low-latency location updates over WebSocket

### Estimated arrival time

- Calculate routes and estimate arrival times using the Google Maps API
- Show estimates with a buffer to reduce late arrivals

### Nearby places to spend time

- Suggest nearby cafés and facilities around the waiting user
- Uses the Google Maps Places API

### Notifications

- Remind users the day before to turn on location sharing
- Notify users when the other person leaves or gets close

---

## Setup

### Requirements

- Go 1.22+
- Node.js 20+
- React Native development environment (Expo or React Native CLI)
- PostgreSQL (local) or a Neon account

### 1. Clone the repository

```bash
git clone https://github.com/nitr0yukkuri/yakinikusoushoku_shisukai.git
cd yakinikusoushoku_shisukai
```

### 2. Configure environment variables

Create one `.env` file in the repository root to manage all variables.

```bash
cp .env.example .env
```

Fill in `.env` using the “Environment variables” table below.

> **Note:** `.env` is in `.gitignore`; create it locally.

### 3. Start the backend

```bash
cd backend
go mod tidy

# Database migrations
psql $DATABASE_URL -f migrations/0001_init.sql
psql $DATABASE_URL -f migrations/0002_friends.sql
psql $DATABASE_URL -f migrations/0003_meetups.sql

# Start the server
go run .
```

### 4. Start the frontend

```bash
cd mobile
npm install
npx expo start
```

### Submission ZIP

The submission ZIP omits `node_modules` to keep the file size down. The dependencies can be regenerated after extracting it:

```bash
cd mobile
npm install
```

After installation, start the app:

```bash
npx expo start
```

---

### 5. When frontend issues occur

Restart Expo and clear its bundler cache:

```bash
cd mobile
npx expo start --clear
```

## Environment variables

Put all environment variables in the root `.env`.  
The Go backend loads `../.env` with `godotenv`, and Expo reads the file automatically at startup.

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | backend | Connection string for Neon or local PostgreSQL |
| `GOOGLE_MAPS_API_KEY` | backend | Google Maps / Places API key (server-side) |
| `JWT_SECRET` | backend | Secret used to sign authentication tokens |
| `PORT` | backend | Server listening port (default: `8080`) |
| `ENV` | backend | Runtime environment (`development` / `production`) |
| `EXPO_PUBLIC_API_URL` | frontend | Base URL for the backend API |
| `EXPO_PUBLIC_WS_URL` | frontend | WebSocket server URL |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | frontend | Google OAuth client ID |

---

## Backend API

Except for `/health` and `/auth/google`, user-facing APIs generally require:

```text
Authorization: Bearer <token>
```

### Friends

- `GET /friends` — list friends
- `GET /friends/search?userId=...` — search by ID
- `POST /friends/requests` — send a friend request
- `GET /friends/requests` — list received and sent requests
- `PUT /friends/requests` — accept, reject, or cancel a request
- `DELETE /friends?userId=...` — remove a friend
- `GET /friends/qr` — data to embed in a QR code

### Meetups

- `GET /meetups` / `POST /meetups` — list and create
- `GET /meetups/{id}` / `PUT /meetups/{id}` / `DELETE /meetups/{id}` — show, edit, and cancel
- `POST /meetups/join` — join using an invite code
- `PUT /meetups/{id}/members` — accept or decline an invitation, or remove a member
- `POST /meetups/{id}/eta` — calculate and save the caller’s ETA with the Google Routes API
- `GET /meetups/{id}/eta` — list the participants’ latest ETAs

### WebSocket

1. Send `meetupId` to `POST /ws/tickets` to get a one-time ticket valid for 60 seconds.
2. Connect to the WebSocket at `GET /ws?ticket=...`.
3. Only approved participants can connect, and the server determines the sender’s user ID.

---

## Target users

- Friends who often hang out together
- Primarily young people (around first- or second-year university students)
- People who are often late or often wait for others
- People who spend time outside
