import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  Alert, ActivityIndicator, Platform, Dimensions, ScrollView,
} from 'react-native'
import Svg, { Polygon as SvgPolygon, Text as SvgText, G as SvgG } from 'react-native-svg'
import * as ImagePicker from 'expo-image-picker'
import { roomsApi, propertiesApi } from '../../api/properties'

const WALLS = ['north', 'south', 'east', 'west']
const { width: SW, height: SH } = Dimensions.get('window')
const MAP_H = Math.round(SH * 0.42)

// ── helpers ──────────────────────────────────────────────────────────────────

function buildWallMap(walls = []) {
  const m = {}
  for (const w of walls) m[w.direction.toLowerCase()] = w.photoUrl
  return { north: m.north || null, south: m.south || null, east: m.east || null, west: m.west || null }
}

function wallsDone(room) {
  return WALLS.filter(d => room.walls[d]).length
}

function roomStatus(room) {
  const n = wallsDone(room)
  if (n === 0) return 'none'
  if (n === 4) return 'complete'
  return 'partial'
}

function polyPoints(pts, sx, sy, ox, oy) {
  return pts.map(p => `${p.x * sx + ox},${p.y * sy + oy}`).join(' ')
}

function centroid(pts) {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  }
}

const STATUS_COLOR = { none: '#374151', partial: '#d97706', complete: '#16a34a' }
const STATUS_FILL  = { none: 'rgba(59,130,246,0.18)', partial: 'rgba(245,158,11,0.22)', complete: 'rgba(34,197,94,0.22)' }
const STATUS_STROKE = { none: '#3b82f6', partial: '#f59e0b', complete: '#22c55e' }

// ── WallSlot ─────────────────────────────────────────────────────────────────

function WallSlot({ direction, photoUrl, uploading, onPress, onRemove, size = 90 }) {
  const label = { north: 'N', south: 'S', east: 'E', west: 'W' }[direction]
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Text style={st.wallDirLabel}>{label}</Text>
      <TouchableOpacity
        style={[st.wallSlot, { width: size, height: size }, photoUrl && st.wallSlotDone]}
        onPress={onPress}
        disabled={uploading}
        activeOpacity={0.75}
      >
        {uploading ? (
          <ActivityIndicator color="#2563eb" />
        ) : photoUrl ? (
          <>
            <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" borderRadius={10} />
            <TouchableOpacity style={st.removeBtn} onPress={onRemove} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={st.removeBtnText}>✕</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={st.wallPlus}>+</Text>
        )}
      </TouchableOpacity>
    </View>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WizardStep3({ navigation, route }) {
  const { propertyId } = route.params
  const [property, setProperty]   = useState(null)
  const [rooms, setRooms]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [uploading, setUploading] = useState({})
  const [mapLayout, setMapLayout] = useState({ width: SW, height: MAP_H })
  const [imgNatural, setImgNatural] = useState(null)

  useEffect(() => {
    Promise.all([propertiesApi.get(propertyId), roomsApi.list(propertyId)])
      .then(([pRes, rRes]) => {
        const prop = pRes.data
        setProperty(prop)
        setRooms(rRes.data.map(r => ({ ...r, walls: buildWallMap(r.walls) })))
        if (prop.floorPlanUrl) {
          Image.getSize(prop.floorPlanUrl,
            (w, h) => setImgNatural({ width: w, height: h }),
            () => {}
          )
        }
      })
      .catch(() => Alert.alert('Error', 'Could not load rooms.'))
      .finally(() => setLoading(false))
  }, [propertyId])

  function getTransform() {
    if (!imgNatural || !mapLayout.width) return null
    const { width: cW, height: cH } = mapLayout
    const { width: iW, height: iH } = imgNatural
    let sx, sy, ox, oy
    if (iW / iH > cW / cH) {
      sx = cW / iW; sy = sx
      ox = 0; oy = (cH - iH * sy) / 2
    } else {
      sy = cH / iH; sx = sy
      ox = (cW - iW * sx) / 2; oy = 0
    }
    return { sx, sy, ox, oy }
  }

  async function captureWall(roomId, direction) {
    const method = await new Promise(resolve =>
      Alert.alert('Add wall photo', direction.charAt(0).toUpperCase() + direction.slice(1) + ' wall', [
        { text: 'Camera',  onPress: () => resolve('camera')  },
        { text: 'Library', onPress: () => resolve('library') },
        { text: 'Cancel',  style: 'cancel', onPress: () => resolve(null) },
      ])
    )
    if (!method) return

    let result
    if (method === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission required', 'Camera access needed.'); return }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    }
    if (result.canceled) return

    const uri = result.assets[0].uri
    const key = `${roomId}_${direction}`
    setUploading(p => ({ ...p, [key]: true }))
    try {
      const ext = uri.split('.').pop() || 'jpg'
      const res = await roomsApi.uploadWallPhoto(roomId, direction, uri, ext)
      setRooms(p => p.map(r => r.id === roomId ? { ...r, walls: { ...r.walls, [direction]: res.data.url } } : r))
    } catch {
      Alert.alert('Upload failed', 'Could not upload. Please try again.')
    } finally {
      setUploading(p => { const n = { ...p }; delete n[key]; return n })
    }
  }

  async function removeWall(roomId, direction) {
    await roomsApi.deleteWall(roomId, direction).catch(() => {})
    setRooms(p => p.map(r => r.id === roomId ? { ...r, walls: { ...r.walls, [direction]: null } } : r))
  }

  if (loading) return <View style={st.center}><ActivityIndicator color="#2563eb" size="large" /></View>

  if (!rooms.length) return (
    <View style={st.center}>
      <Text style={st.gray}>No rooms found.</Text>
      <TouchableOpacity onPress={() => navigation.navigate('WizardStep2', { propertyId })}>
        <Text style={st.link}>← Back to floor plan</Text>
      </TouchableOpacity>
    </View>
  )

  const totalWalls = rooms.length * 4
  const doneWalls  = rooms.reduce((s, r) => s + wallsDone(r), 0)
  const remaining  = totalWalls - doneWalls
  const canNext    = rooms.every(r => wallsDone(r) > 0)
  const transform  = getTransform()
  const hasPolygons = rooms.some(r => r.polygonPoints?.length)

  // ── ROOM DETAIL VIEW ───────────────────────────────────────────────────────
  if (selectedId) {
    const room = rooms.find(r => r.id === selectedId)
    if (!room) { setSelectedId(null); return null }
    const done = wallsDone(room)
    const slotSize = Math.min(Math.round((SW - 80) / 3), 100)
    const centerW  = SW - slotSize * 2 - 48

    return (
      <View style={st.container}>
        {/* Header */}
        <View style={st.detailHeader}>
          <TouchableOpacity style={st.backBtn} onPress={() => setSelectedId(null)}>
            <Text style={st.backBtnText}>← Map</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={st.detailRoomName} numberOfLines={1}>{room.name}</Text>
            <Text style={st.detailRoomMeta}>{room.realWidthM?.toFixed(1)} × {room.realDepthM?.toFixed(1)} m · {done}/4 walls</Text>
          </View>
          {done === 4 && <Text style={st.doneCheck}>✓</Text>}
        </View>

        <ScrollView contentContainerStyle={st.detailScroll} scrollEnabled={false}>
          {/* Compass */}
          <View style={st.compass}>
            {/* North */}
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <WallSlot
                direction="north"
                photoUrl={room.walls.north}
                uploading={!!uploading[`${room.id}_north`]}
                onPress={() => captureWall(room.id, 'north')}
                onRemove={() => removeWall(room.id, 'north')}
                size={slotSize}
              />
            </View>

            {/* Middle row */}
            <View style={st.compassMid}>
              <WallSlot
                direction="west"
                photoUrl={room.walls.west}
                uploading={!!uploading[`${room.id}_west`]}
                onPress={() => captureWall(room.id, 'west')}
                onRemove={() => removeWall(room.id, 'west')}
                size={slotSize}
              />

              {/* Center room box */}
              <View style={[st.compassCenter, { width: centerW, height: slotSize + 20 }]}>
                <Text style={st.compassRoomName} numberOfLines={2}>{room.name}</Text>
                <View style={st.compassDots}>
                  {WALLS.map(d => (
                    <View
                      key={d}
                      style={[st.dot, { backgroundColor: room.walls[d] ? '#22c55e' : '#374151' }]}
                    />
                  ))}
                </View>
              </View>

              <WallSlot
                direction="east"
                photoUrl={room.walls.east}
                uploading={!!uploading[`${room.id}_east`]}
                onPress={() => captureWall(room.id, 'east')}
                onRemove={() => removeWall(room.id, 'east')}
                size={slotSize}
              />
            </View>

            {/* South */}
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <WallSlot
                direction="south"
                photoUrl={room.walls.south}
                uploading={!!uploading[`${room.id}_south`]}
                onPress={() => captureWall(room.id, 'south')}
                onRemove={() => removeWall(room.id, 'south')}
                size={slotSize}
              />
            </View>
          </View>

          <Text style={st.compassHint}>Tap a direction to photograph that wall.{'\n'}Tap the photo to replace it.</Text>

          {/* Next room shortcut */}
          {done === 4 && (() => {
            const idx = rooms.findIndex(r => r.id === selectedId)
            const next = rooms[idx + 1]
            return next ? (
              <TouchableOpacity style={st.nextRoomBtn} onPress={() => setSelectedId(next.id)}>
                <Text style={st.nextRoomBtnText}>Next room: {next.name} →</Text>
              </TouchableOpacity>
            ) : null
          })()}
        </ScrollView>

        <View style={st.footer}>
          <TouchableOpacity style={st.backMapBtn} onPress={() => setSelectedId(null)}>
            <Text style={st.backMapBtnText}>← Back to floor plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // ── MAP VIEW ───────────────────────────────────────────────────────────────
  return (
    <View style={st.container}>
      {/* Progress header */}
      <View style={st.progressHeader}>
        <View>
          <Text style={st.progressTitle}>
            {remaining === 0 ? 'All walls photographed' : `${remaining} wall${remaining !== 1 ? 's' : ''} remaining`}
          </Text>
          <Text style={st.progressSub}>{rooms.length} rooms · tap a room to add photos</Text>
        </View>
        <View style={st.progressBadge}>
          <Text style={st.progressBadgeText}>{doneWalls}/{totalWalls}</Text>
        </View>
      </View>

      {/* Floor plan map */}
      <View
        style={[st.mapContainer, { height: MAP_H }]}
        onLayout={e => setMapLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      >
        {property?.floorPlanUrl ? (
          <>
            <Image
              source={{ uri: property.floorPlanUrl }}
              style={st.mapImage}
              resizeMode="contain"
            />
            {transform && hasPolygons && (
              <Svg style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {rooms.map(room => {
                  const pts = room.polygonPoints
                  if (!pts?.length) return null
                  const status = roomStatus(room)
                  const ctr = centroid(pts)
                  return (
                    <SvgG key={room.id} onPress={() => setSelectedId(room.id)}>
                      <SvgPolygon
                        points={polyPoints(pts, transform.sx, transform.sy, transform.ox, transform.oy)}
                        fill={STATUS_FILL[status]}
                        stroke={STATUS_STROKE[status]}
                        strokeWidth="2"
                      />
                      <SvgText
                        x={ctr.x * transform.sx + transform.ox}
                        y={ctr.y * transform.sy + transform.oy}
                        fontSize="10"
                        fontWeight="600"
                        fill="#ffffff"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {room.name}
                      </SvgText>
                    </SvgG>
                  )
                })}
              </Svg>
            )}
          </>
        ) : (
          <View style={st.noFloorPlan}>
            <Text style={st.noFloorPlanText}>No floor plan uploaded</Text>
          </View>
        )}
      </View>

      {/* Room list */}
      <ScrollView style={st.roomList} contentContainerStyle={st.roomListContent}>
        {rooms.map(room => {
          const status = roomStatus(room)
          const done = wallsDone(room)
          return (
            <TouchableOpacity
              key={room.id}
              style={st.roomRow}
              onPress={() => setSelectedId(room.id)}
              activeOpacity={0.7}
            >
              <View style={[st.statusDot, { backgroundColor: STATUS_COLOR[status] }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.roomRowName}>{room.name}</Text>
                <Text style={st.roomRowMeta}>{done}/4 walls · {room.realWidthM?.toFixed(1)} × {room.realDepthM?.toFixed(1)} m</Text>
              </View>
              {/* Mini wall dots */}
              <View style={st.miniDots}>
                {WALLS.map(d => (
                  <View key={d} style={[st.miniDot, room.walls[d] && st.miniDotDone]} />
                ))}
              </View>
              <Text style={st.rowArrow}>›</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Footer */}
      <View style={st.footer}>
        <TouchableOpacity
          style={[st.nextBtn, !canNext && st.nextBtnOff]}
          onPress={() => navigation.navigate('WizardStep4', { propertyId })}
          disabled={!canNext}
        >
          <Text style={st.nextBtnText}>
            {canNext
              ? 'Next: Review & Publish →'
              : `${rooms.filter(r => !wallsDone(r)).length} room${rooms.filter(r => !wallsDone(r)).length !== 1 ? 's' : ''} still need photos`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#030712' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' },
  gray:       { color: '#6b7280', fontSize: 15, marginBottom: 12 },
  link:       { color: '#60a5fa', fontSize: 14 },

  // Progress header
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  progressTitle:  { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  progressSub:    { color: '#6b7280', fontSize: 12, marginTop: 1 },
  progressBadge:  { backgroundColor: '#1f2937', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressBadgeText: { color: '#9ca3af', fontSize: 13, fontWeight: '700' },

  // Map
  mapContainer:   { backgroundColor: '#0a0f1e', overflow: 'hidden' },
  mapImage:       { width: '100%', height: '100%' },
  noFloorPlan:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  noFloorPlanText: { color: '#374151', fontSize: 14 },

  // Room list
  roomList:        { flex: 1 },
  roomListContent: { paddingBottom: 110 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
    gap: 12,
  },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  roomRowName:  { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  roomRowMeta:  { color: '#6b7280', fontSize: 12, marginTop: 1 },
  miniDots:     { flexDirection: 'row', gap: 4, marginRight: 4 },
  miniDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#1f2937' },
  miniDotDone:  { backgroundColor: '#22c55e' },
  rowArrow:     { color: '#4b5563', fontSize: 20 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#030712',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  nextBtn:     { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  nextBtnOff:  { opacity: 0.45 },
  nextBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },

  // Room detail header
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  backBtn:      { paddingRight: 4 },
  backBtnText:  { color: '#60a5fa', fontSize: 15 },
  detailRoomName: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  detailRoomMeta: { color: '#6b7280', fontSize: 12, marginTop: 1 },
  doneCheck:    { color: '#22c55e', fontSize: 22 },
  detailScroll: { paddingBottom: 120 },

  // Compass
  compass: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  compassMid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  compassCenter: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 8,
    padding: 8,
  },
  compassRoomName: { color: '#9ca3af', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  compassDots:     { flexDirection: 'row', gap: 5, marginTop: 6 },
  dot:             { width: 8, height: 8, borderRadius: 4 },
  compassHint: {
    color: '#374151',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  nextRoomBtn: {
    marginTop: 20,
    marginHorizontal: 32,
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextRoomBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '600' },
  backMapBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backMapBtnText: { color: '#9ca3af', fontSize: 14 },

  // Wall slot
  wallDirLabel: { color: '#6b7280', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  wallSlot: {
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1f2937',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  wallSlotDone:  { borderColor: '#16a34a', borderStyle: 'solid' },
  wallPlus:      { color: '#374151', fontSize: 28 },
  removeBtn: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10, width: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  removeBtnText: { color: '#fff', fontSize: 11, lineHeight: 14 },
})
