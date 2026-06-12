# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Run both client and server concurrently (from repo root)
npm run dev

# Or run individually
npm run dev --workspace=server   # Express server on :3001
npm run dev --workspace=client   # Vite dev server on :5173
```

### Database
```bash
npm run db:push --workspace=server      # Apply schema changes to DB
npm run db:studio --workspace=server    # Open Prisma Studio
npm run db:generate --workspace=server  # Regenerate Prisma client after schema edits
```

### Client build
```bash
npm run build --workspace=client
```

## Environment Setup

Copy `server/.env.example` to `server/.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — any long random string
- `UPLOAD_DIR` — defaults to `./uploads` (local disk, no S3 config needed for dev)

The Prisma schema lives at [server/src/prisma/schema.prisma](server/src/prisma/schema.prisma). After editing it, run `db:push` then `db:generate`.

## Architecture

This is an npm workspaces monorepo with three packages: `client/`, `server/`, and `shared/` (constants only, no build step).

### Server (`server/src/`)
Plain CommonJS Express app. Entry point: [server/src/index.js](server/src/index.js).

- **Routes** — `auth`, `properties`, `rooms`, `share`, `upload`. Room routes are mounted at `/api` (not `/api/rooms`) because they handle both `/api/properties/:id/rooms` and `/api/rooms/:id`.
- **Auth middleware** — JWT verify in [server/src/middleware/auth.js](server/src/middleware/auth.js). Applied per-router, not globally.
- **File storage** — multer writes to local `uploads/` directory in dev. The `/uploads` static route serves those files. Switch to S3 by populating the AWS env vars.
- **Scene Builder** — [server/src/services/sceneBuilder.js](server/src/services/sceneBuilder.js) converts a property's DB record (rooms + walls + photos) into the `sceneData` JSON the Three.js viewer consumes. Currently lays rooms side-by-side on the X axis; actual floor-plan polygon positions are a Phase 2 feature. Triggered via `POST /api/properties/:id/publish`.

### Client (`client/src/`)
React 18 + Vite SPA. No TypeScript (plain JSX). Tailwind for styling.

- **Routing** — [client/src/App.jsx](client/src/App.jsx) defines all routes. The wizard is a nested route under `/properties/:id/wizard` using `<Outlet>`.
- **Auth state** — Zustand store with `persist` middleware, key `pm-auth`. Token is read directly from the store; no refresh token logic yet.
- **API client** — [client/src/api/client.js](client/src/api/client.js) (axios instance). Property API calls are in [client/src/api/properties.js](client/src/api/properties.js).
- **3D Viewer** — React Three Fiber (R3F) + Drei. [client/src/components/Viewer3D/Scene.jsx](client/src/components/Viewer3D/Scene.jsx) is the R3F canvas root. [Room3D.jsx](client/src/components/Viewer3D/Room3D.jsx) renders a box geometry room with wall photo textures. Desktop uses pointer-lock controls ([PlayerControls.jsx](client/src/components/Viewer3D/PlayerControls.jsx)); mobile uses a virtual joystick + swipe ([MobileControls.jsx](client/src/components/Viewer3D/MobileControls.jsx)). Device detection is in [client/src/utils/device.js](client/src/utils/device.js).
- **Wizard** — four nested pages under `WizardLayout`: Step1 (property details), Step2 (floor plan upload + room tracing), Step3 (guided per-room photo upload), Step4 (review + publish trigger).
- **Public viewer** — `GET /tour/:token` → [Viewer.jsx](client/src/pages/Viewer.jsx) fetches scene data from `GET /api/share/:token` (no auth required).

### Data flow for publishing
1. Realtor completes wizard → Step4 calls `POST /api/properties/:id/publish`
2. Server calls `sceneBuilder.build(property)` synchronously (no job queue yet — Bull/Redis is planned for Phase 4)
3. `sceneData` JSON is stored on the property record, status set to `PUBLISHED`
4. Frontend polls or redirects to `/tour/:shareToken`

## Key conventions

- **sceneData format** — the contract between the Scene Builder and the 3D viewer. Any change to `sceneData` shape must be updated in both `sceneBuilder.js` and `Scene.jsx` / `Room3D.jsx`.
- **Wall directions** — the DB enum is `NORTH | SOUTH | EAST | WEST | FLOOR | CEILING`. The scene builder lowercases them as keys in the `walls` object passed to the viewer.
- **Floor plan scale** — stored on `Property.floorPlanScale` as pixels/meter. Room real-world dimensions (`realWidthM`, `realDepthM`) are derived from polygon pixel measurements ÷ scale during the tracing step.
- **CORS** — hardcoded to `http://localhost:5173` in `server/src/index.js`. Update for staging/production.
