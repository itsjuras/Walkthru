# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Server
```bash
npm run dev --workspace=server        # Express server on :3001
npm run db:push --workspace=server    # Apply schema changes to DB
npm run db:studio --workspace=server  # Open Prisma Studio
npm run db:generate --workspace=server # Regenerate Prisma client after schema edits
```

### Web client (buyer viewer only)
```bash
npm run dev --workspace=client        # Vite dev server on :5173
npm run build --workspace=client
```

### Mobile app (realtor)
```bash
cd mobile && npx expo start           # Starts Expo dev server; scan QR in Expo Go
cd mobile && npm install              # Install after adding dependencies
```

## Environment Setup

Copy `server/.env.example` to `server/.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — any long random string
- `UPLOAD_DIR` — defaults to `./uploads` (local disk; populate AWS env vars to switch to S3)

Before testing on a physical device, update `mobile/src/config.js` with your machine's LAN IP:
```bash
ipconfig getifaddr en0   # macOS
```

The Prisma schema lives at [server/src/prisma/schema.prisma](server/src/prisma/schema.prisma). After editing it, run `db:push` then `db:generate`.

## Architecture

This project has three distinct apps sharing one Express backend:

```
server/    — shared Express + Prisma API
client/    — buyer-facing web viewer (React + Vite, no auth)
mobile/    — realtor app (React Native + Expo SDK 51)
shared/    — constants only, no build step
```

### Server (`server/src/`)
Plain CommonJS Express app. Entry point: [server/src/index.js](server/src/index.js).

- **Routes** — `auth`, `properties`, `rooms`, `share`, `upload`. Room routes are mounted at `/api` (not `/api/rooms`) because they handle both `/api/properties/:propertyId/rooms` and `/api/rooms/:id`.
- **Auth middleware** — JWT verify in [server/src/middleware/auth.js](server/src/middleware/auth.js). Applied per-router, not globally. The `/api/health` and `/api/share/:token` routes are intentionally before the auth routers.
- **File storage** — [server/src/services/storage.js](server/src/services/storage.js) transparently switches between local disk and S3 depending on whether `AWS_*` env vars are set. multer uses `memoryStorage()` and hands the buffer to this service.
- **Scene Builder** — [server/src/services/sceneBuilder.js](server/src/services/sceneBuilder.js) converts a property's DB record (rooms + walls + photos) into the `sceneData` JSON the Three.js viewer consumes. When rooms have `polygonPoints` + `floorPlanScale`, it derives world positions from polygon centroids; otherwise falls back to side-by-side X-axis layout. Triggered via `POST /api/properties/:id/publish`.
- **CORS** — allows `localhost:5173` and all LAN IPs (`10.x`, `192.168.x`, `172.16-31.x`) so both the web client and physical phones can reach it simultaneously.

### Web client (`client/src/`) — buyer only
React 18 + Vite SPA. Single route: `/tour/:token` → [Viewer.jsx](client/src/pages/Viewer.jsx). All realtor auth/wizard pages have been removed.

- **3D Viewer** — React Three Fiber + Drei. [Scene.jsx](client/src/components/Viewer3D/Scene.jsx) is the R3F canvas root. [Room3D.jsx](client/src/components/Viewer3D/Room3D.jsx) renders box geometry with wall photo textures using two components — `TexturedWall` and `FlatWall` — to avoid conditional hook calls. Desktop uses pointer-lock ([PlayerControls.jsx](client/src/components/Viewer3D/PlayerControls.jsx)); mobile uses virtual joystick + swipe ([MobileControls.jsx](client/src/components/Viewer3D/MobileControls.jsx)).
- **No auth** — the client has no token, store, or login page. `GET /api/share/:token` is public.

### Mobile app (`mobile/src/`) — realtor only
Expo SDK 51 / React Native 0.74. Entry point: [mobile/App.jsx](mobile/App.jsx). Not part of the npm workspaces — managed separately under `mobile/`.

- **Navigation** — React Navigation native-stack. [src/navigation/index.jsx](mobile/src/navigation/index.jsx) switches between auth screens (no token) and app screens (token present) by reading the Zustand store.
- **Auth state** — Zustand + AsyncStorage persist, key `pm-auth-mobile`. [src/store/authStore.js](mobile/src/store/authStore.js).
- **API client** — axios instance in [src/api/client.js](mobile/src/api/client.js) with JWT interceptor + auto `clearAuth` on 401. Base URL comes from [src/config.js](mobile/src/config.js) — **must be updated to your LAN IP** for physical device testing.
- **Wizard flow** — four screens under `mobile/src/screens/wizard/`:
  - Step1: title + address
  - Step2: floor plan image picker + `FloorPlanTracer` → saves rooms + `floorPlanScale` to server
  - Step3: per-room wall photos (N/S/E/W) via native camera or library
  - Step4: readiness checklist + publish → share link
- **FloorPlanTracer** — [src/components/FloorPlanTracer.jsx](mobile/src/components/FloorPlanTracer.jsx). SVG overlay on the floor plan image with touch responders. Two phases: scale calibration (two taps → real distance input → pixels/meter) then polygon tracing (tap vertices, snap-to-close). Calls `onChange({ pixelsPerMeter, rooms })`.

### Data flow for publishing
1. Realtor completes wizard → Step4 calls `POST /api/properties/:id/publish`
2. Server calls `sceneBuilder.build(property)` synchronously, stores `sceneData` JSON, sets status `PUBLISHED`
3. Realtor shares the tour URL; buyer opens it in the web client at `/tour/:shareToken`

## Key conventions

- **sceneData contract** — any change to the shape must be updated in both `sceneBuilder.js` and `Scene.jsx` / `Room3D.jsx`.
- **Wall directions** — DB enum is `NORTH | SOUTH | EAST | WEST | FLOOR | CEILING`. The scene builder lowercases them as keys in the `walls` object. Rooms from the API include `walls: [{ direction, photoUrl }]` — an array, not flat fields.
- **Room dimensions** — DB fields are `realWidthM` / `realDepthM` (not `widthM`/`depthM`). Derived from polygon bounding box ÷ `floorPlanScale` during the tracing step; stored at create time.
- **Floor plan scale** — stored on `Property.floorPlanScale` (pixels/meter). Set by the mobile Step2 wizard via `PUT /api/properties/:id`.
