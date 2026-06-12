# PropertyMapper — Full System Architecture

## Vision

A platform where realtors follow a guided wizard to upload a floor plan + room photos, and the system generates a shareable interactive 3D walkthrough that buyers can tour entirely online.

---

## How It Works (End-to-End Flow)

```
Realtor uploads floor plan
        ↓
Browser-based room tracing tool
(draw polygons over rooms, set scale + ceiling heights)
        ↓
Guided photo upload wizard
(system walks realtor through exactly which photos to take, room by room)
        ↓
Scene Builder (server-side)
assembles 3D geometry from floor plan data + maps photos as wall textures
        ↓
Published property gets a shareable link
        ↓
Buyer opens link → interactive 3D walkthrough
(WASD + mouse on desktop / joystick + swipe on mobile)
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React (Vite) | Fast dev, large ecosystem |
| 3D Viewer | Three.js + React Three Fiber | Industry standard WebGL, great docs |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Backend | Node.js + Express | JS throughout, easy to prototype |
| Database | PostgreSQL | Relational data, solid for property/room models |
| ORM | Prisma | Type-safe, great DX |
| File Storage | AWS S3 (or local disk for dev) | Scalable photo storage |
| Auth | JWT + bcrypt | Simple, stateless |
| Background Jobs | Bull (Redis-backed) | Scene generation is async |
| Deployment | Frontend: Vercel / Backend: Railway or Render | Easy, cheap to start |

---

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    BROWSER (React SPA)                        │
│                                                               │
│  ┌─────────────┐   ┌──────────────────┐   ┌───────────────┐  │
│  │  Realtor    │   │   Upload Wizard  │   │  3D Viewer    │  │
│  │  Dashboard  │   │  (guided steps)  │   │  (Three.js)   │  │
│  └─────────────┘   └──────────────────┘   └───────────────┘  │
│         │                  │                      │           │
│         └──────────────────┴──────────────────────┘           │
│                            │                                   │
│                       REST API calls                           │
└────────────────────────────┼──────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                 NODE.JS + EXPRESS API SERVER                   │
│                                                               │
│  ┌──────────┐  ┌────────────┐  ┌───────────┐  ┌──────────┐  │
│  │   Auth   │  │  Property  │  │   Room    │  │  Scene   │  │
│  │  /login  │  │    API     │  │    API    │  │ Builder  │  │
│  │ /signup  │  │  /create   │  │  /trace   │  │  (async) │  │
│  └──────────┘  │  /publish  │  │  /photos  │  └──────────┘  │
│                └────────────┘  └───────────┘                  │
└────────────────────┬──────────────────────┬───────────────────┘
                     │                      │
          ┌──────────▼──────┐     ┌─────────▼────────┐
          │   PostgreSQL     │     │   File Storage   │
          │  (Prisma ORM)    │     │   (S3 / local)   │
          │                  │     │                  │
          │  users           │     │  floor-plans/    │
          │  properties      │     │  room-photos/    │
          │  rooms           │     │  thumbnails/     │
          │  walls           │     └──────────────────┘
          │  share_tokens    │
          └──────────────────┘
```

---

## Data Model

```prisma
model User {
  id          String     @id @default(cuid())
  email       String     @unique
  password    String     // bcrypt hash
  name        String
  role        Role       @default(REALTOR)
  properties  Property[]
  createdAt   DateTime   @default(now())
}

model Property {
  id              String     @id @default(cuid())
  userId          String
  user            User       @relation(fields: [userId], references: [id])
  address         String
  title           String
  floorPlanUrl    String?    // uploaded floor plan image
  floorPlanScale  Float?     // pixels per meter, set during tracing
  status          Status     @default(DRAFT)
  shareToken      String     @unique @default(cuid())
  rooms           Room[]
  createdAt       DateTime   @default(now())
  publishedAt     DateTime?
}

model Room {
  id              String   @id @default(cuid())
  propertyId      String
  property        Property @relation(fields: [propertyId], references: [id])
  name            String   // "Kitchen", "Master Bedroom", etc.
  // Floor plan polygon (array of {x,y} in floor-plan pixel space)
  polygonPoints   Json     // [{x: 120, y: 340}, ...]
  // Real-world dimensions derived from scale
  realWidthM      Float    // meters
  realDepthM      Float    // meters
  ceilingHeightM  Float    @default(2.4)
  // 3D world position (set by scene builder)
  worldX          Float    @default(0)
  worldY          Float    @default(0)
  worldZ          Float    @default(0)
  walls           Wall[]
  order           Int      // traversal order (entrance first)
}

model Wall {
  id          String    @id @default(cuid())
  roomId      String
  room        Room      @relation(fields: [roomId], references: [id])
  direction   Direction // NORTH | SOUTH | EAST | WEST | FLOOR | CEILING
  photoUrl    String?
  photoNote   String?   // realtor caption
}

enum Role    { REALTOR ADMIN }
enum Status  { DRAFT PROCESSING PUBLISHED ARCHIVED }
enum Direction { NORTH SOUTH EAST WEST FLOOR CEILING }
```

---

## Frontend Pages & Components

```
src/
├── pages/
│   ├── Landing.jsx            # Marketing homepage
│   ├── Login.jsx
│   ├── Signup.jsx
│   ├── Dashboard.jsx          # Realtor's property list
│   ├── PropertyNew.jsx        # Start new property
│   ├── wizard/
│   │   ├── Step1_Details.jsx  # Address, title, room count
│   │   ├── Step2_FloorPlan.jsx # Upload + trace rooms
│   │   ├── Step3_Photos.jsx   # Guided per-room photo upload
│   │   ├── Step4_Review.jsx   # Preview before generating
│   │   └── WizardLayout.jsx   # Progress bar + step wrapper
│   └── Viewer.jsx             # Public 3D walkthrough (via share link)
│
├── components/
│   ├── FloorPlanTracer/
│   │   ├── TracerCanvas.jsx   # Canvas overlay for drawing room polygons
│   │   ├── ScaleSetter.jsx    # Mark two points, enter real distance
│   │   └── RoomLabel.jsx      # Name + ceiling height per room
│   ├── PhotoWizard/
│   │   ├── RoomPhotoStep.jsx  # One room at a time
│   │   ├── WallPhotoSlot.jsx  # Upload slot per wall direction
│   │   └── PhotoInstructions.jsx # Contextual instructions per shot
│   └── Viewer3D/
│       ├── Scene.jsx          # React Three Fiber scene root
│       ├── Room3D.jsx         # Box geometry per room
│       ├── PlayerControls.jsx # WASD + mouse (desktop)
│       ├── MobileControls.jsx # Joystick + swipe (mobile)
│       └── Minimap.jsx        # 2D floor plan overlay (optional)
```

---

## The Upload Wizard — Step by Step

### Step 1 — Property Details
- Property title, full address
- Estimated number of rooms (helps set expectations for Step 3)

### Step 2 — Floor Plan Tracing
This is the core data-capture step.

1. Realtor uploads floor plan image (JPG/PNG/PDF)
2. System displays the floor plan in a browser canvas
3. **Scale calibration**: realtor clicks two points on the floor plan and enters the real-world distance between them (e.g., "this wall is 5 meters"). This sets `floorPlanScale` (pixels/meter).
4. **Room tracing**: realtor draws a polygon around each room by clicking corners. After closing the polygon:
   - Enter room name
   - Set ceiling height (default 2.4m)
5. **Doorway marking** (optional, Phase 2): mark where rooms connect

### Step 3 — Guided Photo Upload
For each room (in order), the system walks the realtor through exactly what to photograph:

```
📷 Kitchen — Wall Photos

You are standing in the center of the room.

  [North Wall ↑]   Upload a photo facing NORTH (toward the window side)
  [South Wall ↓]   Upload a photo facing SOUTH (toward the door)
  [East Wall →]    Upload a photo facing EAST
  [West Wall ←]    Upload a photo facing WEST
  [Floor]          Optional: looking straight down
  [Ceiling]        Optional: looking straight up

Tips:
• Use your phone's wide-angle (0.5x) lens if available
• Stand in the center of the room for each shot
• Make sure lighting is consistent — turn on all lights
• Do not include people or pets in photos
```

Each wall slot shows a diagram of the room with the direction highlighted.

### Step 4 — Review & Generate
- Thumbnail grid of all uploaded photos
- Confirm room order for walkthrough
- "Generate Walkthrough" → triggers server-side scene build
- Processing status indicator, then redirect to viewer

---

## 3D Scene Builder (Server-Side)

**Input:** Property record with all rooms, walls, photos, scale, polygon data

**Process:**
1. For each room, calculate real-world width/depth from polygon + scale
2. Assign 3D world positions by converting floor plan coordinates to 3D space (Y-up, scale 1 unit = 1 meter)
3. Build scene descriptor JSON:
```json
{
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "position": { "x": 0, "y": 0, "z": 0 },
      "size": { "w": 5.2, "h": 2.4, "d": 4.1 },
      "walls": {
        "north": "https://s3.../photo1.jpg",
        "south": "https://s3.../photo2.jpg",
        "east":  "https://s3.../photo3.jpg",
        "west":  "https://s3.../photo4.jpg"
      }
    }
  ],
  "connections": [
    { "from": "room_1", "to": "room_2", "via": "north-wall" }
  ],
  "startPosition": { "x": 0, "y": 1.6, "z": 0 },
  "startLookAt": { "x": 0, "y": 1.6, "z": -1 }
}
```
4. Store scene JSON in DB / S3
5. Update property status to PUBLISHED

---

## 3D Viewer — Controls

### Desktop
| Action | Control |
|---|---|
| Move forward | W / ↑ |
| Move backward | S / ↓ |
| Strafe left | A / ← |
| Strafe right | D / → |
| Look around | Mouse (pointer lock) |
| Click to enter pointer lock | Click on canvas |
| Exit pointer lock | Escape |

### Mobile
- **Left half of screen**: Virtual joystick (appears where you touch, controls movement)
- **Right half of screen**: Drag to look/rotate camera
- Joystick auto-centers when released
- Handles touch events, no separate button needed

---

## API Endpoints

```
Auth
  POST /api/auth/signup
  POST /api/auth/login
  GET  /api/auth/me

Properties
  GET    /api/properties              # list mine
  POST   /api/properties              # create
  GET    /api/properties/:id
  PUT    /api/properties/:id
  DELETE /api/properties/:id
  POST   /api/properties/:id/publish  # trigger scene build

Rooms
  GET    /api/properties/:id/rooms
  POST   /api/properties/:id/rooms
  PUT    /api/rooms/:id
  DELETE /api/rooms/:id

Walls / Photos
  PUT    /api/rooms/:id/walls/:direction  # upload photo
  DELETE /api/rooms/:id/walls/:direction

Files
  POST   /api/upload                  # presigned S3 upload or direct
  POST   /api/upload/floor-plan

Public (no auth)
  GET    /api/share/:token            # fetch scene data for viewer
```

---

## Build Phases

### Phase 1 — Foundation (Weeks 1–3)
- [ ] Monorepo setup (client/ + server/)
- [ ] Auth (signup, login, JWT middleware)
- [ ] Property CRUD API + dashboard UI
- [ ] File upload endpoint (local disk first, S3 later)
- [ ] Basic floor plan upload (display image, no tracing yet)
- [ ] Minimal 3D viewer (hardcoded box room) to prove Three.js works

### Phase 2 — Floor Plan Tracer (Weeks 4–6)
- [ ] Canvas-based polygon room tracer
- [ ] Scale calibration tool
- [ ] Room naming + ceiling height input
- [ ] Persist traced room data to DB
- [ ] Auto-calculate real-world room dimensions

### Phase 3 — Photo Wizard (Weeks 7–9)
- [ ] Guided room-by-room photo upload UI
- [ ] Contextual instructions per wall direction
- [ ] Photo slot upload + preview
- [ ] Review screen before submission

### Phase 4 — Scene Builder + Full Viewer (Weeks 10–13)
- [ ] Scene Builder service (floor plan data → scene JSON)
- [ ] Three.js viewer reads scene JSON, builds rooms + textures
- [ ] Desktop controls (WASD + pointer lock)
- [ ] Mobile controls (joystick + swipe)
- [ ] Share link generation + public viewer route
- [ ] Processing status UI

### Phase 5 — Polish (Weeks 14–16)
- [ ] Performance: compressed textures, LOD
- [ ] Minimap overlay in viewer
- [ ] Property listing embed code (copy/paste for Zillow, etc.)
- [ ] Mobile-responsive dashboard
- [ ] Error handling + retry flows

### Phase 6 — Consumer Features (Future)
- [ ] Consumer accounts (save favorite properties)
- [ ] In-viewer measurement tool
- [ ] Furniture placement overlay
- [ ] AI-powered floor plan auto-detection (skip manual tracing)
- [ ] 360° photo support (equirectangular)
- [ ] Video-to-frame extraction for texture sources

---

## Project Folder Structure

```
PropertyMapper/
├── client/                    # React frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── store/             # Zustand or Context
│   │   ├── api/               # API client (axios)
│   │   └── utils/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                    # Node.js + Express
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── properties.js
│   │   │   ├── rooms.js
│   │   │   └── share.js
│   │   ├── middleware/
│   │   │   ├── auth.js        # JWT verify
│   │   │   └── upload.js      # multer config
│   │   ├── services/
│   │   │   ├── sceneBuilder.js
│   │   │   └── storage.js
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── index.js
│   ├── .env.example
│   └── package.json
│
├── shared/                    # Shared types/constants
│   └── constants.js
│
├── ARCHITECTURE.md            # This file
└── package.json               # Root (workspaces)
```

---

## Key Design Decisions & Rationale

**Why manual room tracing (not AI detection)?**
Floor plans vary wildly — hand-drawn, PDF exports, scanned paper. AI room detection is unreliable on edge cases. Manual tracing is slower but produces perfect data every time. AI detection can be added in Phase 6 as an accelerator, not a dependency.

**Why box geometry (not photogrammetry)?**
Photogrammetry (NeRF/Gaussian Splatting) requires specialized capture, processing hours, and expensive GPU compute. Box rooms + photo textures can be generated in seconds, work with normal phone photos, and produce a result that's "good enough" for property browsing. The tradeoff is visual fidelity vs. accessibility — and realtors can't be expected to have DSLR rigs.

**Why per-wall photos instead of 360° photos?**
360° cameras are not common. Per-wall photos work with any phone. The guided wizard ensures complete coverage. If a realtor later upgrades to a 360° camera, equirectangular support can be added as a wall type.

**Why pointer lock for desktop?**
Standard FPS feel. No awkward click-drag. The viewer should feel like a video game, not a clunky web tool.

**Why React Three Fiber over raw Three.js?**
R3F brings Three.js into React's component model. State management, hooks, and cleanup are handled automatically. The ecosystem (Drei, Rapier) adds ready-made helpers like pointer-lock controls, joysticks, and environment maps.
```
