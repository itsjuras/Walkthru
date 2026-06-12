/**
 * Scene Builder
 *
 * Converts a property record (rooms + walls from DB) into the sceneData JSON
 * that the Three.js viewer consumes.
 *
 * Room placement strategy:
 *   - If rooms have polygonPoints AND the property has floorPlanScale:
 *       derive worldX/worldZ from the polygon centroid, offsetting so the
 *       top-left of the traced area sits at the world origin.
 *   - Otherwise (no floor plan data): lay rooms out side-by-side on the X axis.
 *
 * sceneData shape:
 * {
 *   rooms: [{ id, name, position: {x,y,z}, size: {w,h,d}, walls: {north,...} }],
 *   startPosition: { x, y, z },
 * }
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

function centroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function bboxDimensions(pts, ppm) {
  const xs = pts.map(p => p.x)
  const ys = pts.map(p => p.y)
  return {
    w: Math.max(1.0, (Math.max(...xs) - Math.min(...xs)) / ppm),
    d: Math.max(1.0, (Math.max(...ys) - Math.min(...ys)) / ppm),
  }
}

function absoluteUrl(url) {
  if (!url) return null
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
}

async function build(property) {
  const { rooms, floorPlanScale } = property

  if (!rooms || rooms.length === 0) {
    throw new Error('Property has no rooms. Add at least one room before publishing.')
  }

  const ppm = floorPlanScale || null

  // Check whether we can use polygon-based placement
  const canUsePoly = ppm && rooms.every(r => Array.isArray(r.polygonPoints) && r.polygonPoints.length >= 3)

  let sceneRooms

  if (canUsePoly) {
    // --- Polygon-based placement ---
    // Find bounding box of all polygon points so we can offset to world origin
    const allPts = rooms.flatMap(r => r.polygonPoints)
    const minX = Math.min(...allPts.map(p => p.x))
    const minY = Math.min(...allPts.map(p => p.y))

    sceneRooms = rooms.map(room => {
      const pts = room.polygonPoints
      const c = centroid(pts)
      const { w, d } = bboxDimensions(pts, ppm)
      const h = room.ceilingHeightM || 2.4

      return {
        id: room.id,
        name: room.name,
        position: {
          x: (c.x - minX) / ppm,
          y: 0,
          z: (c.y - minY) / ppm,
        },
        size: { w, h, d },
        walls: buildWalls(room),
      }
    })
  } else {
    // --- Fallback: side-by-side layout ---
    let cursor = 0
    sceneRooms = rooms.map(room => {
      const w = room.realWidthM || 4.0
      const d = room.realDepthM || 4.0
      const h = room.ceilingHeightM || 2.4

      const x = (room.worldX && room.worldX !== 0) ? room.worldX : cursor + w / 2
      const z = (room.worldZ && room.worldZ !== 0) ? room.worldZ : 0
      cursor += w + 0.3

      return {
        id: room.id,
        name: room.name,
        position: { x, y: 0, z },
        size: { w, h, d },
        walls: buildWalls(room),
      }
    })
  }

  // Start position: standing near the entrance of the first room (south face, eye height)
  const first = sceneRooms[0]
  const startPosition = {
    x: first.position.x,
    y: 1.6,
    z: first.position.z + first.size.d / 2 - 0.5,
  }

  return { rooms: sceneRooms, startPosition }
}

function buildWalls(room) {
  const walls = {}
  for (const wall of room.walls) {
    const dir = wall.direction.toLowerCase()
    if (wall.photoUrl) walls[dir] = absoluteUrl(wall.photoUrl)
  }
  return walls
}

module.exports = { build }
