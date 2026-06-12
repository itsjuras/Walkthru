import { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Image, StyleSheet,
  FlatList, Alert, ActivityIndicator, ScrollView, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { roomsApi } from '../../api/properties'

const WALLS = ['north', 'south', 'east', 'west']
const WALL_LABELS = { north: 'North wall', south: 'South wall', east: 'East wall', west: 'West wall' }

function WallSlot({ direction, photoUrl, onCapture, onRemove, uploading }) {
  return (
    <View style={styles.wallSlot}>
      <Text style={styles.wallLabel}>{WALL_LABELS[direction]}</Text>
      {photoUrl ? (
        <View style={styles.wallPreviewWrap}>
          <Image source={{ uri: photoUrl }} style={styles.wallPreview} />
          <TouchableOpacity style={styles.wallRemoveBtn} onPress={onRemove}>
            <Text style={styles.wallRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.wallAdd} onPress={onCapture} disabled={uploading}>
          {uploading
            ? <ActivityIndicator color="#2563eb" />
            : <>
                <Text style={styles.wallAddIcon}>+</Text>
                <Text style={styles.wallAddText}>Add photo</Text>
              </>
          }
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function WizardStep3({ navigation, route }) {
  const { propertyId } = route.params
  const [rooms, setRooms]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState({})   // { roomId_direction: true }
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    roomsApi.list(propertyId)
      .then(res => setRooms(res.data.map(r => {
        const wallMap = {}
        for (const w of (r.walls || [])) {
          wallMap[w.direction.toLowerCase()] = w.photoUrl
        }
        return {
          ...r,
          walls: {
            north: wallMap.north || null,
            south: wallMap.south || null,
            east:  wallMap.east  || null,
            west:  wallMap.west  || null,
          },
        }
      })))
      .catch(() => Alert.alert('Error', 'Could not load rooms.'))
      .finally(() => setLoading(false))
  }, [propertyId])

  async function captureWall(roomId, direction) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    const libStatus  = await ImagePicker.requestMediaLibraryPermissionsAsync()

    const method = await new Promise(resolve => {
      Alert.alert('Add wall photo', 'Choose source', [
        { text: 'Camera',  onPress: () => resolve('camera')  },
        { text: 'Library', onPress: () => resolve('library') },
        { text: 'Cancel',  style: 'cancel', onPress: () => resolve(null) },
      ])
    })
    if (!method) return

    let result
    if (method === 'camera') {
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed.')
        return
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 })
    } else {
      if (libStatus.status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed.')
        return
      }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    }
    if (result.canceled) return

    const uri = result.assets[0].uri
    const key = `${roomId}_${direction}`
    setUploading(prev => ({ ...prev, [key]: true }))

    try {
      const ext = uri.split('.').pop() || 'jpg'
      const res = await roomsApi.uploadWallPhoto(roomId, direction, uri, ext)
      const photoUrl = res.data.url

      setRooms(prev => prev.map(r =>
        r.id === roomId
          ? { ...r, walls: { ...r.walls, [direction]: photoUrl } }
          : r
      ))
    } catch {
      Alert.alert('Upload failed', 'Could not upload the photo. Please try again.')
    } finally {
      setUploading(prev => { const n = { ...prev }; delete n[key]; return n })
    }
  }

  async function removeWall(roomId, direction) {
    try {
      await roomsApi.deleteWall(roomId, direction)
      setRooms(prev => prev.map(r =>
        r.id === roomId ? { ...r, walls: { ...r.walls, [direction]: null } } : r
      ))
    } catch {
      Alert.alert('Error', 'Could not remove photo.')
    }
  }

  const totalWalls     = rooms.length * 4
  const filledWalls    = rooms.reduce((sum, r) => sum + WALLS.filter(d => r.walls[d]).length, 0)
  const allFilled      = filledWalls === totalWalls && totalWalls > 0
  const canNext        = rooms.length > 0 && filledWalls >= rooms.length  // at least 1 photo per room

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>
  }

  if (rooms.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No rooms found.</Text>
        <TouchableOpacity onPress={() => navigation.navigate('WizardStep2', { propertyId })}>
          <Text style={styles.backLink}>← Go back and trace rooms</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.progress}>
          {filledWalls} / {totalWalls} wall photos added
        </Text>

        {rooms.map(room => (
          <View key={room.id} style={styles.roomCard}>
            <Text style={styles.roomName}>{room.name}</Text>
            <Text style={styles.roomMeta}>{room.realWidthM?.toFixed(1)}×{room.realDepthM?.toFixed(1)}m · {room.ceilingHeightM}m ceiling</Text>

            <View style={styles.wallsGrid}>
              {WALLS.map(dir => (
                <WallSlot
                  key={dir}
                  direction={dir}
                  photoUrl={room.walls[dir]}
                  uploading={!!uploading[`${room.id}_${dir}`]}
                  onCapture={() => captureWall(room.id, dir)}
                  onRemove={() => removeWall(room.id, dir)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !canNext && styles.btnDisabled]}
          onPress={() => navigation.navigate('WizardStep4', { propertyId })}
          disabled={!canNext}
        >
          <Text style={styles.nextBtnText}>
            {canNext
              ? 'Next: Review & Publish →'
              : `Add at least 1 photo per room (${rooms.length - filledWalls} remaining)`
            }
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' },
  list:      { padding: 16, paddingBottom: 110 },
  progress:  { color: '#6b7280', fontSize: 12, marginBottom: 16 },
  emptyText: { color: '#6b7280', fontSize: 15, marginBottom: 12 },
  backLink:  { color: '#60a5fa', fontSize: 14 },
  roomCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  roomName:  { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 2 },
  roomMeta:  { color: '#6b7280', fontSize: 12, marginBottom: 14 },
  wallsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wallSlot:  { width: '47%' },
  wallLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 5 },
  wallPreviewWrap: { position: 'relative' },
  wallPreview: { width: '100%', aspectRatio: 4/3, borderRadius: 10 },
  wallRemoveBtn: {
    position: 'absolute', top: 6, right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, width: 24, height: 24,
    justifyContent: 'center', alignItems: 'center',
  },
  wallRemoveText: { color: '#fff', fontSize: 13, lineHeight: 16 },
  wallAdd: {
    width: '100%', aspectRatio: 4/3,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  wallAddIcon: { color: '#4b5563', fontSize: 26, lineHeight: 30 },
  wallAddText: { color: '#4b5563', fontSize: 11, marginTop: 2 },
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: '#030712',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  nextBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  nextBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  btnDisabled: { opacity: 0.5 },
})
