import { useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import FloorPlanTracer from '../../components/FloorPlanTracer'
import { uploadApi, roomsApi, propertiesApi } from '../../api/properties'

export default function WizardStep2({ navigation, route }) {
  const { propertyId } = route.params
  const [imageUri, setImageUri]     = useState(null)
  const [floorPlanUrl, setFloorPlanUrl] = useState(null)
  const [traceData, setTraceData]   = useState({ pixelsPerMeter: null, rooms: [] })
  const [saving, setSaving]         = useState(false)

  async function pickImage(fromCamera) {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to photograph the floor plan.')
        return
      }
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 })

    if (result.canceled) return
    const uri = result.assets[0].uri
    setImageUri(uri)
    setTraceData({ pixelsPerMeter: null, rooms: [] })

    // Upload floor plan immediately so the server has it stored
    try {
      const ext = uri.split('.').pop() || 'jpg'
      const res = await uploadApi.floorPlan(uri, ext, propertyId)
      setFloorPlanUrl(res.data.url)
    } catch (err) {
      Alert.alert('Upload failed', 'Could not upload the floor plan image. You can still trace rooms.')
    }
  }

  async function handleNext() {
    if (traceData.rooms.length === 0) {
      Alert.alert('No rooms traced', 'Please trace at least one room on the floor plan.')
      return
    }
    setSaving(true)
    try {
      // Fetch existing rooms so we can delete stale ones
      const existingRes = await roomsApi.list(propertyId)
      const existing = existingRes.data

      // Delete rooms that were removed during re-trace
      await Promise.all(existing.map(r => roomsApi.delete(r.id)))

      // Save scale at the property level
      if (traceData.pixelsPerMeter) {
        await propertiesApi.update(propertyId, { floorPlanScale: traceData.pixelsPerMeter })
      }

      // Create all traced rooms
      for (const room of traceData.rooms) {
        await roomsApi.create(propertyId, {
          name: room.name,
          realWidthM: room.realWidthM,
          realDepthM: room.realDepthM,
          ceilingHeightM: room.ceilingHeightM,
          polygonPoints: room.points,
        })
      }

      navigation.navigate('WizardStep3', { propertyId })
    } catch (err) {
      Alert.alert('Error', 'Could not save rooms. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!imageUri) {
    return (
      <View style={styles.pick}>
        <Text style={styles.pickTitle}>Add floor plan</Text>
        <Text style={styles.pickSub}>Photograph or choose an existing image of the floor plan. You'll trace the rooms on top.</Text>

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

  const canNext = traceData.rooms.length > 0

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        <FloorPlanTracer imageUri={imageUri} onChange={setTraceData} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.changeImgBtn}
          onPress={() => { setImageUri(null); setFloorPlanUrl(null) }}
        >
          <Text style={styles.changeImgText}>Change image</Text>
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
  container:  { flex: 1, backgroundColor: '#030712' },
  pick: {
    flex: 1,
    backgroundColor: '#030712',
    paddingHorizontal: 28,
    paddingTop: 48,
    alignItems: 'center',
  },
  pickTitle:  { color: '#ffffff', fontSize: 22, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  pickSub:    { color: '#6b7280', fontSize: 14, textAlign: 'center', marginBottom: 40, lineHeight: 20 },
  pickBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  pickBtnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#2563eb' },
  pickBtnText:    { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  pickBtnTextOutline: { color: '#60a5fa', fontSize: 16, fontWeight: '600' },
  skipBtn:  { marginTop: 16 },
  skipText: { color: '#4b5563', fontSize: 14 },
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
  changeImgText: { color: '#9ca3af', fontSize: 14 },
  nextBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
})
