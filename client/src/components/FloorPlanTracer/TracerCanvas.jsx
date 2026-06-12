/**
 * TracerCanvas — self-contained floor plan tracer.
 *
 * Flow:
 *   1. Scale calibration: click two points on the image → enter real distance → pixels/meter computed
 *   2. Room tracing: click to draw polygon vertices, click near first point to close
 *      → name + ceiling height dialog appears inline
 *   3. Completed rooms shown as colored overlays with labels
 *   4. Calls onChange({ pixelsPerMeter, rooms }) after every state change
 *
 * Props:
 *   imageUrl      — URL of the uploaded floor plan image
 *   initialScale  — optional pixels/meter already stored in DB
 *   initialRooms  — optional rooms already in DB [{name, ceilingHeightM, polygonPoints}]
 *   onChange      — ({ pixelsPerMeter, rooms: [{name, ceilingHeightM, points, realWidthM, realDepthM}] }) => void
 */

import { useRef, useState, useEffect, useCallback } from 'react'

const ROOM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']
const SNAP_RADIUS = 14    // px — how close to first vertex triggers close
const DOT_R = 5

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function polygonCentroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function roomDimensions(points, pixelsPerMeter) {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const ppm = pixelsPerMeter || 100
  return {
    realWidthM: Math.max(0.5, (Math.max(...xs) - Math.min(...xs)) / ppm),
    realDepthM: Math.max(0.5, (Math.max(...ys) - Math.min(...ys)) / ppm),
  }
}

export default function TracerCanvas({ imageUrl, initialScale, initialRooms, onChange }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const [imgReady, setImgReady] = useState(false)

  // Scale calibration state
  const [phase, setPhase] = useState(initialScale ? 'tracing' : 'scale-p1')
  // phase: 'scale-p1' | 'scale-p2' | 'scale-input' | 'tracing'
  const [scaleP1, setScaleP1] = useState(null)
  const [scaleP2, setScaleP2] = useState(null)
  const [scaleMeters, setScaleMeters] = useState('')
  const [pixelsPerMeter, setPixelsPerMeter] = useState(initialScale || null)

  // Room tracing state
  const [rooms, setRooms] = useState(
    (initialRooms || []).map(r => ({ ...r, points: r.polygonPoints || [] }))
  )
  const [drawing, setDrawing] = useState([])       // vertices of in-progress polygon
  const [mousePos, setMousePos] = useState(null)
  const [pendingPolygon, setPendingPolygon] = useState(null) // polygon awaiting naming
  const [pendingName, setPendingName] = useState('')
  const [pendingCeiling, setPendingCeiling] = useState('2.4')

  // Notify parent on change
  useEffect(() => {
    if (!onChange) return
    onChange({
      pixelsPerMeter,
      rooms: rooms.map(r => ({
        name: r.name,
        ceilingHeightM: r.ceilingHeightM,
        points: r.points,
        ...roomDimensions(r.points, pixelsPerMeter),
      })),
    })
  }, [pixelsPerMeter, rooms])

  // ── Canvas drawing ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imgReady) return

    canvas.width = img.clientWidth
    canvas.height = img.clientHeight
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Completed rooms
    rooms.forEach((room, i) => {
      if (room.points.length < 2) return
      const color = ROOM_COLORS[i % ROOM_COLORS.length]
      ctx.beginPath()
      room.points.forEach((pt, j) => (j === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
      ctx.closePath()
      ctx.fillStyle = color + '33'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.stroke()

      const { x: cx, y: cy } = polygonCentroid(room.points)
      const fontSize = Math.max(11, Math.round(canvas.width / 55))
      ctx.font = `bold ${fontSize}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'
      ctx.strokeText(room.name, cx, cy)
      ctx.fillStyle = '#fff'
      ctx.fillText(room.name, cx, cy)
    })

    // In-progress polygon
    if (drawing.length > 0) {
      ctx.beginPath()
      drawing.forEach((pt, j) => (j === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)))
      if (mousePos) ctx.lineTo(mousePos.x, mousePos.y)
      ctx.setLineDash([5, 4])
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.setLineDash([])

      // Vertex dots
      drawing.forEach((pt, j) => {
        const isFirst = j === 0
        const snapping = isFirst && drawing.length >= 3 && mousePos && dist(mousePos, pt) < SNAP_RADIUS
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, snapping ? SNAP_RADIUS : DOT_R, 0, Math.PI * 2)
        ctx.fillStyle = snapping ? 'rgba(16,185,129,0.4)' : isFirst ? '#3b82f6' : '#fff'
        ctx.fill()
        ctx.strokeStyle = snapping ? '#10b981' : '#3b82f6'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }

    // Scale points + line
    const drawDot = (pt, color) => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    if (scaleP1) drawDot(scaleP1, '#fbbf24')
    if (scaleP2) drawDot(scaleP2, '#fbbf24')

    if (scaleP1 && scaleP2) {
      ctx.beginPath()
      ctx.moveTo(scaleP1.x, scaleP1.y)
      ctx.lineTo(scaleP2.x, scaleP2.y)
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.stroke()
      ctx.setLineDash([])
    } else if (scaleP1 && mousePos && (phase === 'scale-p1' || phase === 'scale-p2')) {
      ctx.beginPath()
      ctx.moveTo(scaleP1.x, scaleP1.y)
      ctx.lineTo(mousePos.x, mousePos.y)
      ctx.strokeStyle = 'rgba(251,191,36,0.6)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }
  })

  // ── Event helpers ──────────────────────────────────────────────────────────
  function toCanvasCoords(e) {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleMouseMove = useCallback((e) => {
    setMousePos(toCanvasCoords(e))
  }, [])

  const handleClick = useCallback((e) => {
    e.preventDefault()
    const pt = toCanvasCoords(e)
    if (!pt) return

    if (phase === 'scale-p1') {
      setScaleP1(pt)
      setPhase('scale-p2')
      return
    }
    if (phase === 'scale-p2') {
      setScaleP2(pt)
      setPhase('scale-input')
      return
    }
    if (phase === 'tracing') {
      if (drawing.length >= 3 && dist(pt, drawing[0]) < SNAP_RADIUS) {
        // Close polygon
        setPendingPolygon(drawing)
        setDrawing([])
        setPendingName('')
        setPendingCeiling('2.4')
      } else {
        setDrawing(prev => [...prev, pt])
      }
    }
  }, [phase, drawing])

  // ── Scale confirmation ─────────────────────────────────────────────────────
  function confirmScale(e) {
    e.preventDefault()
    const meters = parseFloat(scaleMeters)
    if (!meters || meters <= 0 || !scaleP1 || !scaleP2) return
    const ppm = dist(scaleP1, scaleP2) / meters
    setPixelsPerMeter(ppm)
    setPhase('tracing')
  }

  function resetScale() {
    setScaleP1(null)
    setScaleP2(null)
    setScaleMeters('')
    setPhase('scale-p1')
    setPixelsPerMeter(null)
  }

  // ── Room naming ────────────────────────────────────────────────────────────
  function confirmRoom(e) {
    e.preventDefault()
    if (!pendingPolygon || !pendingName.trim()) return
    setRooms(prev => [...prev, {
      points: pendingPolygon,
      name: pendingName.trim(),
      ceilingHeightM: parseFloat(pendingCeiling) || 2.4,
    }])
    setPendingPolygon(null)
  }

  function cancelRoom() {
    setPendingPolygon(null)
    setDrawing([])
  }

  function deleteRoom(i) {
    setRooms(prev => prev.filter((_, idx) => idx !== i))
  }

  // ── UI hints ───────────────────────────────────────────────────────────────
  const hint = {
    'scale-p1': 'Click the FIRST point of a known distance on the floor plan',
    'scale-p2': 'Click the SECOND point of the same measurement',
    'scale-input': 'Enter the real-world distance between those two points',
    'tracing': rooms.length === 0
      ? 'Click to draw the first room polygon. Click the first dot to close.'
      : 'Keep drawing rooms, or click Next when done',
  }[phase]

  return (
    <div>
      {/* Instruction bar */}
      <div className="mb-2 flex items-center gap-3">
        <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 flex-1">{hint}</span>
        {phase === 'tracing' && (
          <button
            type="button"
            onClick={resetScale}
            className="text-xs text-yellow-400 hover:underline whitespace-nowrap"
          >
            Re-calibrate scale
          </button>
        )}
        {phase === 'tracing' && drawing.length > 0 && (
          <button
            type="button"
            onClick={() => setDrawing([])}
            className="text-xs text-red-400 hover:underline whitespace-nowrap"
          >
            Cancel room
          </button>
        )}
      </div>

      {/* Canvas area */}
      <div style={{ position: 'relative' }}>
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Floor plan"
          style={{ display: 'block', width: '100%', userSelect: 'none' }}
          onLoad={() => setImgReady(true)}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: '100%', height: '100%',
            cursor: phase === 'tracing' ? 'crosshair' : 'crosshair',
            touchAction: 'none',
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setMousePos(null)}
        />
      </div>

      {/* Scale input dialog */}
      {phase === 'scale-input' && (
        <form
          onSubmit={confirmScale}
          className="mt-3 bg-yellow-900/40 border border-yellow-600 rounded-xl p-4 flex items-center gap-3 flex-wrap"
        >
          <span className="text-yellow-300 text-sm font-medium">Real-world distance between the two points:</span>
          <input
            autoFocus
            type="number" min="0.1" step="0.01"
            value={scaleMeters}
            onChange={e => setScaleMeters(e.target.value)}
            placeholder="e.g. 5.0"
            className="w-28 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
          <span className="text-yellow-300 text-sm">meters</span>
          <button
            type="submit"
            disabled={!scaleMeters || parseFloat(scaleMeters) <= 0}
            className="px-4 py-1.5 bg-yellow-600 text-white rounded-lg text-sm font-semibold hover:bg-yellow-500 disabled:opacity-40"
          >
            Set Scale
          </button>
          <button type="button" onClick={resetScale} className="text-xs text-gray-400 hover:text-white">
            Start over
          </button>
        </form>
      )}

      {/* Room naming dialog */}
      {pendingPolygon && (
        <form
          onSubmit={confirmRoom}
          className="mt-3 bg-blue-900/40 border border-blue-600 rounded-xl p-4 flex items-center gap-3 flex-wrap"
        >
          <span className="text-blue-300 text-sm font-medium">Name this room:</span>
          <input
            autoFocus
            type="text"
            value={pendingName}
            onChange={e => setPendingName(e.target.value)}
            placeholder="e.g. Living Room"
            className="flex-1 min-w-32 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-blue-300 text-sm">Ceiling:</span>
          <input
            type="number" min="1.8" max="6" step="0.1"
            value={pendingCeiling}
            onChange={e => setPendingCeiling(e.target.value)}
            className="w-20 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-blue-300 text-sm">m</span>
          <button
            type="submit"
            disabled={!pendingName.trim()}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
          >
            Add Room
          </button>
          <button type="button" onClick={cancelRoom} className="text-xs text-gray-400 hover:text-white">
            Discard
          </button>
        </form>
      )}

      {/* Traced rooms list */}
      {rooms.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Traced rooms</p>
          <div className="space-y-1">
            {rooms.map((room, i) => {
              const { realWidthM, realDepthM } = roomDimensions(room.points, pixelsPerMeter)
              return (
                <div key={i} className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2">
                  <span
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ background: ROOM_COLORS[i % ROOM_COLORS.length] }}
                  />
                  <span className="text-sm text-white flex-1">{room.name}</span>
                  <span className="text-xs text-gray-400">
                    {realWidthM.toFixed(1)} × {realDepthM.toFixed(1)} m · {room.ceilingHeightM} m ceiling
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteRoom(i)}
                    className="text-xs text-red-400 hover:text-red-300 ml-2"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
