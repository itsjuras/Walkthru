import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform,
  TextInput, KeyboardAvoidingView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import FloorPlanTracer from '../../components/FloorPlanTracer'
import { uploadApi, roomsApi, propertiesApi, extractApi } from '../../api/properties'

// mode: null | 'choose' | 'detecting' | 'review' | 'trace'

export default function WizardStep2({ navigation, route }) {
  const { propertyId } = route.params
  const [imageUri, setImageUri]           = useState(null)
  const [floorPlanUrl, setFloorPlanUrl]   = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [mode, setMode]                   = useState(null)
  const [detectedRooms, setDetectedRooms] = useState([])
  const [traceData, setTraceData]         = useState({ pixelsPerMeter: null, rooms: [] })
  const [saving, setSaving]               = useState(false)

  async function pickImage(fromCamera) {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to photograph the floor plan.')
        return
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })

    if (result.canceled) return
    const uri = result.assets[0].uri
    setImageUri(uri)
    setMode(null)
    setDetectedRooms([])
    setTraceData({ pixelsPerMeter: null, rooms: [] })
    setUploading(true)

    try {
      const ext = uri.split('.').pop() || 'jpg'
      const res = await uploadApi.floorPlan(uri, ext, propertyId)
      setFloorPlanUrl(res.data.url)
      setMode('choose')
    } catch {
      Alert.alert('Upload failed', 'Could not upload the floor plan. You can still trace rooms manually.')
      setMode('choose')
    } finally {
      setUploading(false)
    }
  }

  async function handleAutoDetect() {
    if (!floorPlanUrl) {
      Alert.alert('Still uploading', 'Please wait for the floor plan to finish uploading.')
      return
    }
    setMode('detecting')
    try {
      const res = await extractApi.extractRooms(imageUri)
      const rooms = (res.data.rooms || []).map((r, i) => ({
        id: i,
        name: r.name || 'Room',
        realWidthM: String(r.widthM || 3.0),
        realDepthM: String(r.depthM || 3.0),
        ceilingHeightM: String(r.ceilingHeightM || 2.4),
      }))
      if (rooms.length === 0) {
        Alert.alert('No rooms detected', 'Claude could not find room labels. Try the manual trace instead.')
        setMode('choose')
        return
      }
      setDetectedRooms(rooms)
      setMode('review')
    } catch (err) {
      Alert.alert('Detection failed', err?.response?.data?.message || err.message || 'Try again or trace manually.')
      setMode('choose')
    }
  }

  function updateRoom(id, field, value) {
    setDetectedRooms(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  function removeRoom(id) {
    setDetectedRooms(prev => prev.filter(r => r.id !== id))
  }

  function addRoom() {
    setDetectedRooms(prev => [
      ...prev,
      { id: Date.now(), name: 'New Room', realWidthM: '3.0', realDepthM: '3.0', ceilingHeightM: '2.4' },
    ])
  }

  async function handleNext() {
    let rooms = []

    if (mode === 'review') {
      if (detectedRooms.length === 0) {
        Alert.alert('No rooms', 'Add at least one room.')
        return
      }
      rooms = detectedRooms.map(r => ({
        name: r.name.trim() || 'Room',
        realWidthM: Math.max(0.5, parseFloat(r.realWidthM) || 3.0),
        realDepthM: Math.max(0.5, parseFloat(r.realDepthM) || 3.0),
        ceilingHeightM: Math.max(2.0, parseFloat(r.ceilingHeightM) || 2.4),
        points: null,
      }))
    } else if (mode === 'trace') {
      if (traceData.rooms.length === 0) {
        Alert.alert('No rooms traced', 'Please trace at least one room on the floor plan.')
        return
      }
      rooms = traceData.rooms
    } else {
      Alert.alert('No rooms', 'Use Auto-detect or trace rooms manually.')
      return
    }

    setSaving(true)
    try {
      const existingRes = await roomsApi.list(propertyId)
      await Promise.all((existingRes.data || []).map(r => roomsApi.delete(r.id)))

      if (traceData.pixelsPerMeter && mode === 'trace') {
        await propertiesApi.update(propertyId, { floorPlanScale: traceData.pixelsPerMeter })
      }

      for (const room of rooms) {
        await roomsApi.create(propertyId, {
          name: room.name,
          realWidthM: room.realWidthM,
          realDepthM: room.realDepthM,
          ceilingHeightM: room.ceilingHeightM,
          polygonPoints: room.points || null,
        })
      }

      navigation.navigate('WizardStep3', { propertyId })
    } catch {
      Alert.alert('Error', 'Could not save rooms. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── No image yet ─────────────────────────────────────────────────────────────
  if (!imageUri) {
    return (
      <View style={styles.pick}>
        <Text style={styles.pickTitle}>Add floor plan</Text>
        <Text style={styles.pickSub}>
          Photograph or choose a floor plan image. Claude can auto-detect rooms, or you can trace them manually.
        </Text>

        <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(false)}>
          <Text style={styles.pickBtnText}>Choose from library</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.pickBtn, styles.pickBtnOutline]} onPress={() => pickImage(true)}>
          <Text style={styles.pickBtnTextOutline}>Take a photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => navigation.navigate('WizardStep3', { propertyId })}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── Uploading ────────────────────────────────────────────────────────────────
  if (uploading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.statusText}>Uploading floor plan…</Text>
      </View>
    )
  }

  // ── AI detecting ─────────────────────────────────────────────────────────────
  if (mode === 'detecting') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text style={styles.statusText}>Claude is reading the floor plan…</Text>
        <Text style={styles.statusSub}>This takes 5–15 seconds</Text>
      </View>
    )
  }

  // ── Choose mode ──────────────────────────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <View style={styles.pick}>
        <Text style={styles.pickTitle}>How would you like to add rooms?</Text>
        <Text style={styles.pickSub}>Floor plan uploaded. Choose how to define the rooms.</Text>

        <TouchableOpacity style={[styles.pickBtn, styles.aiBtn]} onPress={handleAutoDetect}>
          <Text style={styles.aiBtnIcon}>✦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pickBtnText}>Auto-detect rooms (AI)</Text>
            <Text style={styles.aiBtnSub}>Claude reads the floor plan and extracts room dimensions</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.pickBtn, styles.pickBtnOutline]} onPress={() => setMode('trace')}>
          <Text style={styles.pickBtnTextOutline}>Trace rooms manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={() => { setImageUri(null); setFloorPlanUrl(null); setMode(null) }}>
          <Text style={styles.skipText}>Change image</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // ── AI review ────────────────────────────────────────────────────────────────
  if (mode === 'review') {
    const roomCount = detectedRooms.length
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.reviewContent} keyboardShouldPersistTaps="handled">
            <View style={styles.reviewHeader}>
              <Text style={styles.reviewTitle}>Detected {roomCount} room{roomCount !== 1 ? 's' : ''}</Text>
              <Text style={styles.reviewSub}>Review and edit dimensions before saving.</Text>
            </View>

            {detectedRooms.map(room => (
              <View key={room.id} style={styles.roomCard}>
                <View style={styles.roomCardRow}>
                  <TextInput
                    style={[styles.roomInput, styles.roomNameInput]}
                    value={room.name}
                    onChangeText={v => updateRoom(room.id, 'name', v)}
                    placeholder="Room name"
                    placeholderTextColor="#4b5563"
                  />
                  <TouchableOpacity onPress={() => removeRoom(room.id)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.roomCardRow}>
                  <View style={styles.dimField}>
                    <Text style={styles.dimLabel}>Width (m)</Text>
                    <TextInput
                      style={styles.roomInput}
                      value={room.realWidthM}
                      onChangeText={v => updateRoom(room.id, 'realWidthM', v)}
                      keyboardType="decimal-pad"
                      placeholder="3.0"
                      placeholderTextColor="#4b5563"
                    />
                  </View>
                  <View style={styles.dimField}>
                    <Text style={styles.dimLabel}>Depth (m)</Text>
                    <TextInput
                      style={styles.roomInput}
                      value={room.realDepthM}
                      onChangeText={v => updateRoom(room.id, 'realDepthM', v)}
                      keyboardType="decimal-pad"
                      placeholder="3.0"
                      placeholderTextColor="#4b5563"
                    />
                  </View>
                  <View style={styles.dimField}>
                    <Text style={styles.dimLabel}>Ceiling (m)</Text>
                    <TextInput
                      style={styles.roomInput}
                      value={room.ceilingHeightM}
                      onChangeText={v => updateRoom(room.id, 'ceilingHeightM', v)}
                      keyboardType="decimal-pad"
                      placeholder="2.4"
                      placeholderTextColor="#4b5563"
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addRoomBtn} onPress={addRoom}>
              <Text style={styles.addRoomText}>+ Add room</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.redetectBtn} onPress={handleAutoDetect}>
              <Text style={styles.redetectText}>Re-detect with AI</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.traceInsteadBtn} onPress={() => setMode('trace')}>
              <Text style={styles.traceInsteadText}>Switch to manual trace instead</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.nextBtn, (saving || roomCount === 0) && styles.btnDisabled]}
              onPress={handleNext}
              disabled={saving || roomCount === 0}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.nextBtnText}>
                    Save {roomCount} room{roomCount !== 1 ? 's' : ''} →
                  </Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Manual trace ─────────────────────────────────────────────────────────────
  const canNext = traceData.rooms.length > 0

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <FloorPlanTracer imageUri={imageUri} onChange={setTraceData} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.changeImgBtn} onPress={() => setMode('choose')}>
          <Text style={styles.changeImgText}>← Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, (!canNext || saving) && styles.btnDisabled]}
          onPress={handleNext}
          disabled={!canNext || saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.nextBtnText}>
                {traceData.rooms.length > 0
                  ? `Next: Add photos (${traceData.rooms.length} room${traceData.rooms.length !== 1 ? 's' : ''}) →`
                  : 'Trace at least one room'}
              </Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#030712' },
  center:       { flex: 1, backgroundColor: '#030712', alignItems: 'center', justifyContent: 'center', padding: 32 },
  statusText:   { color: '#e5e7eb', fontSize: 16, fontWeight: '600', marginTop: 20, textAlign: 'center' },
  statusSub:    { color: '#6b7280', fontSize: 13, marginTop: 8, textAlign: 'center' },

  pick: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  pickTitle:          { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  pickSub:            { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 40, lineHeight: 20 },
  pickBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
  },
  pickBtnOutline:     { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2563eb' },
  pickBtnText:        { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  pickBtnTextOutline: { color: '#60a5fa', fontSize: 16, fontWeight: '600' },
  aiBtn:              { backgroundColor: '#4c1d95', borderWidth: 1, borderColor: '#7c3aed' },
  aiBtnIcon:          { color: '#c4b5fd', fontSize: 20 },
  aiBtnSub:           { color: '#c4b5fd', fontSize: 12, marginTop: 2 },
  skipBtn:            { marginTop: 16 },
  skipText:           { color: '#4b5563', fontSize: 14 },

  reviewContent:    { padding: 16, paddingBottom: 100 },
  reviewHeader:     { marginBottom: 20 },
  reviewTitle:      { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  reviewSub:        { color: '#6b7280', fontSize: 13, marginTop: 4 },

  roomCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 8,
  },
  roomCardRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  roomInput: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    color: '#f9fafb',
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flex: 1,
  },
  roomNameInput:  { fontSize: 15, fontWeight: '600' },
  removeBtn:      { paddingHorizontal: 8, paddingVertical: 8 },
  removeBtnText:  { color: '#6b7280', fontSize: 16 },
  dimField:       { flex: 1, gap: 4 },
  dimLabel:       { color: '#6b7280', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },

  addRoomBtn: {
    borderWidth: 1,
    borderColor: '#1f2937',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  addRoomText:      { color: '#4b5563', fontSize: 14 },
  redetectBtn:      { alignItems: 'center', paddingVertical: 10, marginBottom: 8 },
  redetectText:     { color: '#7c3aed', fontSize: 13, fontWeight: '600' },
  traceInsteadBtn:  { alignItems: 'center', paddingVertical: 10 },
  traceInsteadText: { color: '#4b5563', fontSize: 13 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#030712',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  changeImgBtn: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    justifyContent: 'center',
  },
  changeImgText:  { color: '#9ca3af', fontSize: 14 },
  nextBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText:  { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  btnDisabled:  { opacity: 0.5 },
})
