/**
 * FloorPlanTracer — touch-based scale calibration + polygon room tracing.
 *
 * Renders the floor plan image with an SVG overlay. Taps on the overlay
 * place scale calibration points or polygon vertices. Works entirely in
 * the coordinate space of the displayed image (no letterboxing — image
 * aspect ratio is preserved by setting View aspectRatio to match image).
 *
 * Props:
 *   imageUri   — local URI of the floor plan image
 *   onChange   — ({ pixelsPerMeter, rooms }) called after every state change
 */

import { useState, useEffect } from 'react'
import {
  View, Text, Image, TextInput, TouchableOpacity,
  StyleSheet, Modal,
} from 'react-native'
import Svg, { Line, Polyline, Polygon, Circle, Text as SvgText, G as SvgG } from 'react-native-svg'

const ROOM_COLORS   = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']
const SNAP_RADIUS   = 18   // px — tap within this of first vertex to close polygon
const DOT_R         = 6

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function centroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

function roomDimensions(points, ppm) {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const scale = ppm || 100
  return {
    realWidthM: Math.max(0.5, (Math.max(...xs) - Math.min(...xs)) / scale),
    realDepthM: Math.max(0.5, (Math.max(...ys) - Math.min(...ys)) / scale),
  }
}

export default function FloorPlanTracer({ imageUri, onChange }) {
  const [containerSize, setContainerSize] = useState(null)
  const [aspectRatio, setAspectRatio]     = useState(1)

  // Scale calibration
  const [phase, setPhase]           = useState('scale-p1')
  // 'scale-p1' | 'scale-p2' | 'scale-done' | 'tracing'
  const [scaleP1, setScaleP1]       = useState(null)
  const [scaleP2, setScaleP2]       = useState(null)
  const [ppm, setPpm]               = useState(null)   // pixels per meter
  const [scaleModal, setScaleModal] = useState(false)
  const [metersInput, setMetersInput] = useState('')

  // Room tracing
  const [rooms, setRooms]           = useState([])
  const [drawing, setDrawing]       = useState([])
  const [namingPoints, setNamingPoints] = useState(null)
  const [nameInput, setNameInput]   = useState('')
  const [ceilingInput, setCeilingInput] = useState('2.4')

  // Resolve image natural dimensions for aspect ratio
  useEffect(() => {
    Image.getSize(imageUri, (w, h) => setAspectRatio(w / h), () => {})
  }, [imageUri])

  // Notify parent
  useEffect(() => {
    if (!onChange) return
    onChange({
      pixelsPerMeter: ppm,
      rooms: rooms.map(r => ({
        name: r.name,
        ceilingHeightM: r.ceilingHeightM,
        points: r.points,
        ...roomDimensions(r.points, ppm),
      })),
    })
  }, [ppm, rooms])

  // ── Touch handler ──────────────────────────────────────────────────────────
  function handleTap(e) {
    const { locationX: x, locationY: y } = e.nativeEvent
    const pt = { x, y }

    if (phase === 'scale-p1') {
      setScaleP1(pt)
      setPhase('scale-p2')
      return
    }
    if (phase === 'scale-p2') {
      setScaleP2(pt)
      setScaleModal(true)
      return
    }
    if (phase === 'tracing') {
      if (drawing.length >= 3 && dist(pt, drawing[0]) < SNAP_RADIUS) {
        setNamingPoints(drawing)
        setDrawing([])
        setNameInput('')
        setCeilingInput('2.4')
      } else {
        setDrawing(prev => [...prev, pt])
      }
    }
  }

  // ── Scale confirm ──────────────────────────────────────────────────────────
  function confirmScale() {
    const meters = parseFloat(metersInput)
    if (!meters || meters <= 0) return
    const pixDist = dist(scaleP1, scaleP2)
    setPpm(pixDist / meters)
    setScaleModal(false)
    setPhase('tracing')
  }

  function resetScale() {
    setScaleP1(null)
    setScaleP2(null)
    setMetersInput('')
    setPpm(null)
    setDrawing([])
    setPhase('scale-p1')
  }

  // ── Room confirm ───────────────────────────────────────────────────────────
  function confirmRoom() {
    if (!nameInput.trim()) return
    setRooms(prev => [...prev, {
      points: namingPoints,
      name: nameInput.trim(),
      ceilingHeightM: parseFloat(ceilingInput) || 2.4,
    }])
    setNamingPoints(null)
  }

  // ── Instruction text ───────────────────────────────────────────────────────
  const hint = {
    'scale-p1': 'Tap the first point of a known measurement',
    'scale-p2': 'Tap the second point',
    'tracing':  drawing.length === 0 ? 'Tap to start drawing a room' : `${drawing.length} point${drawing.length !== 1 ? 's' : ''} — tap near the first dot to close`,
  }[phase] ?? ''

  return (
    <View style={styles.wrapper}>
      {/* Instruction bar */}
      <View style={styles.hintBar}>
        <Text style={styles.hintText}>{hint}</Text>
        {phase === 'tracing' && (
          <TouchableOpacity onPress={resetScale}>
            <Text style={styles.resetBtn}>Re-calibrate</Text>
          </TouchableOpacity>
        )}
        {phase === 'tracing' && drawing.length > 0 && (
          <TouchableOpacity onPress={() => setDrawing([])}>
            <Text style={styles.cancelBtn}>Cancel room</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Image + SVG overlay */}
      <View
        style={[styles.canvas, containerSize ? { height: containerSize.width / aspectRatio } : {}]}
        onLayout={e => setContainerSize(e.nativeEvent.layout)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={handleTap}
      >
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="stretch"
        />

        {containerSize && (
          <Svg style={StyleSheet.absoluteFill} width={containerSize.width} height={containerSize.width / aspectRatio}>

            {/* Completed rooms */}
            {rooms.map((room, i) => {
              const color = ROOM_COLORS[i % ROOM_COLORS.length]
              const pts = room.points.map(p => `${p.x},${p.y}`).join(' ')
              const c = centroid(room.points)
              const { realWidthM, realDepthM } = roomDimensions(room.points, ppm)
              return (
                <SvgG key={i}>
                  <Polygon
                    points={pts}
                    fill={color + '40'}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <SvgText
                    x={c.x} y={c.y - 8}
                    fontSize={13} fontWeight="bold"
                    fill="#ffffff"
                    stroke="#000000" strokeWidth={3}
                    paintOrder="stroke"
                    textAnchor="middle"
                  >
                    {room.name}
                  </SvgText>
                  <SvgText
                    x={c.x} y={c.y + 10}
                    fontSize={10}
                    fill="#d1d5db"
                    stroke="#000000" strokeWidth={2}
                    paintOrder="stroke"
                    textAnchor="middle"
                  >
                    {realWidthM.toFixed(1)}×{realDepthM.toFixed(1)}m
                  </SvgText>
                </SvgG>
              )
            })}

            {/* In-progress polygon */}
            {drawing.length > 1 && (
              <Polyline
                points={drawing.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth={1.5}
                strokeDasharray="5,4"
              />
            )}
            {drawing.map((pt, i) => (
              <Circle
                key={i}
                cx={pt.x} cy={pt.y}
                r={i === 0 ? DOT_R + 2 : DOT_R}
                fill={i === 0 ? '#3b82f6' : '#ffffff'}
                stroke="#3b82f6"
                strokeWidth={2}
              />
            ))}

            {/* Scale points + line */}
            {scaleP1 && <Circle cx={scaleP1.x} cy={scaleP1.y} r={7} fill="#fbbf24" stroke="#000" strokeWidth={1.5} />}
            {scaleP2 && <Circle cx={scaleP2.x} cy={scaleP2.y} r={7} fill="#fbbf24" stroke="#000" strokeWidth={1.5} />}
            {scaleP1 && scaleP2 && (
              <Line
                x1={scaleP1.x} y1={scaleP1.y}
                x2={scaleP2.x} y2={scaleP2.y}
                stroke="#fbbf24" strokeWidth={2} strokeDasharray="6,4"
              />
            )}
          </Svg>
        )}
      </View>

      {/* Traced rooms list */}
      {rooms.length > 0 && (
        <View style={styles.roomList}>
          {rooms.map((r, i) => {
            const { realWidthM, realDepthM } = roomDimensions(r.points, ppm)
            return (
              <View key={i} style={styles.roomRow}>
                <View style={[styles.roomDot, { backgroundColor: ROOM_COLORS[i % ROOM_COLORS.length] }]} />
                <Text style={styles.roomName}>{r.name}</Text>
                <Text style={styles.roomMeta}>{realWidthM.toFixed(1)}×{realDepthM.toFixed(1)}m · {r.ceilingHeightM}m</Text>
                <TouchableOpacity onPress={() => setRooms(prev => prev.filter((_, idx) => idx !== i))}>
                  <Text style={styles.removeRoom}>✕</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}

      {/* Scale distance modal */}
      <Modal visible={scaleModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Real-world distance</Text>
            <Text style={styles.modalSub}>How far apart are those two points in meters?</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 5.0"
              placeholderTextColor="#4b5563"
              value={metersInput}
              onChangeText={setMetersInput}
              keyboardType="decimal-pad"
              autoFocus
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setScaleModal(false); resetScale() }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !metersInput && styles.btnDisabled]}
                onPress={confirmScale}
                disabled={!metersInput}
              >
                <Text style={styles.modalConfirmText}>Set Scale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Room naming modal */}
      <Modal visible={!!namingPoints} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Name this room</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Living Room"
              placeholderTextColor="#4b5563"
              value={nameInput}
              onChangeText={setNameInput}
              autoFocus
            />
            <Text style={styles.modalSub}>Ceiling height (meters)</Text>
            <TextInput
              style={styles.modalInput}
              value={ceilingInput}
              onChangeText={setCeilingInput}
              keyboardType="decimal-pad"
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setNamingPoints(null)}>
                <Text style={styles.modalCancelText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !nameInput.trim() && styles.btnDisabled]}
                onPress={confirmRoom}
                disabled={!nameInput.trim()}
              >
                <Text style={styles.modalConfirmText}>Add Room</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper:  { flex: 1 },
  hintBar:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#111827', flexWrap: 'wrap' },
  hintText: { color: '#9ca3af', fontSize: 12, flex: 1 },
  resetBtn: { color: '#fbbf24', fontSize: 12 },
  cancelBtn:{ color: '#f87171', fontSize: 12 },
  canvas:   { width: '100%', backgroundColor: '#000' },
  roomList: { padding: 12, gap: 6 },
  roomRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#111827', borderRadius: 8, padding: 10 },
  roomDot:  { width: 10, height: 10, borderRadius: 3 },
  roomName: { color: '#ffffff', fontSize: 13, flex: 1 },
  roomMeta: { color: '#6b7280', fontSize: 11 },
  removeRoom:{ color: '#f87171', fontSize: 14, paddingHorizontal: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard:    { backgroundColor: '#111827', borderRadius: 20, padding: 24, width: '85%' },
  modalTitle:   { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  modalSub:     { color: '#9ca3af', fontSize: 13, marginBottom: 12 },
  modalInput:   { backgroundColor: '#1f2937', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#ffffff', fontSize: 16, marginBottom: 16 },
  modalRow:     { flexDirection: 'row', gap: 10 },
  modalCancel:  { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1f2937', alignItems: 'center' },
  modalCancelText: { color: '#9ca3af', fontWeight: '600' },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#2563eb', alignItems: 'center' },
  modalConfirmText: { color: '#ffffff', fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
})
