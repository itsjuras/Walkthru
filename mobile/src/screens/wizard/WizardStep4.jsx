import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Platform, Share,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { propertiesApi, roomsApi } from '../../api/properties'
import { API_BASE_URL } from '../../config'

const WALLS = ['north', 'south', 'east', 'west']

function Check({ ok, label }) {
  return (
    <View style={styles.checkRow}>
      <Text style={ok ? styles.checkOk : styles.checkFail}>{ok ? '✓' : '✗'}</Text>
      <Text style={[styles.checkLabel, !ok && styles.checkLabelFail]}>{label}</Text>
    </View>
  )
}

function shareUrl(token) {
  const base = API_BASE_URL.replace('/api', '').replace(':3001', ':5173')
  return `${base}/tour/${token}`
}

export default function WizardStep4({ navigation, route }) {
  const { propertyId } = route.params
  const [property, setProperty] = useState(null)
  const [rooms, setRooms]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [publishing, setPublishing] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [pRes, rRes] = await Promise.all([
        propertiesApi.get(propertyId),
        roomsApi.list(propertyId),
      ])
      setProperty(pRes.data)
      setRooms(rRes.data)
    } catch {
      Alert.alert('Error', 'Could not load property details.')
    } finally {
      setLoading(false)
    }
  }

  useFocusEffect(useCallback(() => { load() }, [propertyId]))

  // Readiness checks
  const hasTitle     = !!(property?.title && property.title !== 'New Property')
  const hasAddress   = !!property?.address
  const hasRooms     = rooms.length > 0
  const roomsWithPhotos = rooms.filter(r =>
    (r.walls || []).some(w => w.photoUrl)
  ).length
  const allRoomsHavePhotos = hasRooms && roomsWithPhotos === rooms.length
  const isReady = hasTitle && hasAddress && hasRooms && allRoomsHavePhotos

  async function handlePublish() {
    if (!isReady) return
    setPublishing(true)
    try {
      await propertiesApi.publish(propertyId)
      await load()
      Alert.alert(
        'Published!',
        'Your 3D walkthrough is live. Share the link with buyers.',
        [{ text: 'Share link', onPress: () => shareLink() }, { text: 'Done' }]
      )
    } catch (err) {
      Alert.alert('Error', err.response?.data?.message || 'Could not publish. Please try again.')
    } finally {
      setPublishing(false)
    }
  }

  async function shareLink() {
    if (!property?.shareToken) return
    try {
      await Share.share({ message: shareUrl(property.shareToken) })
    } catch {}
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#2563eb" /></View>
  }

  const isPublished = property?.status === 'PUBLISHED'

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Property summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Property details</Text>
        <Text style={styles.propTitle}>{property?.title || '—'}</Text>
        <Text style={styles.propAddress}>{property?.address || '—'}</Text>
      </View>

      {/* Checklist */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Readiness check</Text>
        <View style={styles.checklist}>
          <Check ok={hasTitle}  label="Title set" />
          <Check ok={hasAddress} label="Address set" />
          <Check ok={hasRooms}   label={`${rooms.length} room${rooms.length !== 1 ? 's' : ''} traced`} />
          <Check
            ok={allRoomsHavePhotos}
            label={`Wall photos (${roomsWithPhotos}/${rooms.length} rooms complete)`}
          />
        </View>
      </View>

      {/* Room breakdown */}
      {rooms.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rooms</Text>
          {rooms.map(r => {
            const wallsFilled = (r.walls || []).filter(w => w.photoUrl).length
            return (
              <View key={r.id} style={styles.roomRow}>
                <View style={styles.roomInfo}>
                  <Text style={styles.roomName}>{r.name}</Text>
                  <Text style={styles.roomMeta}>
                    {r.realWidthM?.toFixed(1)}×{r.realDepthM?.toFixed(1)}m · {wallsFilled}/4 photos
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.navigate('WizardStep3', { propertyId })}
                >
                  <Text style={styles.editLink}>Edit</Text>
                </TouchableOpacity>
              </View>
            )
          })}
        </View>
      )}

      {/* Action area */}
      {isPublished ? (
        <View style={styles.publishedBox}>
          <Text style={styles.publishedTitle}>Live</Text>
          <Text style={styles.publishedSub}>Your walkthrough is published and accessible to buyers.</Text>
          <TouchableOpacity style={styles.shareBtn} onPress={shareLink}>
            <Text style={styles.shareBtnText}>Share link</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.unpublishBtn}
            onPress={async () => {
              try {
                await propertiesApi.update(propertyId, { status: 'DRAFT' })
                await load()
              } catch { Alert.alert('Error', 'Could not unpublish.') }
            }}
          >
            <Text style={styles.unpublishText}>Unpublish</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {!isReady && (
            <Text style={styles.notReadyHint}>
              Complete all checks above before publishing.
            </Text>
          )}
          <TouchableOpacity
            style={[styles.publishBtn, (!isReady || publishing) && styles.btnDisabled]}
            onPress={handlePublish}
            disabled={!isReady || publishing}
          >
            {publishing
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.publishBtnText}>Publish walkthrough</Text>
            }
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.navigate('Dashboard')}>
        <Text style={styles.doneBtnText}>Back to dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  inner:     { padding: 20, paddingBottom: 48 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' },
  section: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  sectionTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  propTitle:   { color: '#ffffff', fontSize: 18, fontWeight: '700', marginBottom: 3 },
  propAddress: { color: '#9ca3af', fontSize: 14 },
  checklist: { gap: 10 },
  checkRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkOk:   { color: '#22c55e', fontSize: 16, width: 20 },
  checkFail: { color: '#f87171', fontSize: 16, width: 20 },
  checkLabel: { color: '#d1d5db', fontSize: 14 },
  checkLabelFail: { color: '#9ca3af' },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  roomInfo:  {},
  roomName:  { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  roomMeta:  { color: '#6b7280', fontSize: 12, marginTop: 1 },
  editLink:  { color: '#60a5fa', fontSize: 13 },
  notReadyHint: { color: '#f87171', fontSize: 13, textAlign: 'center', marginBottom: 12 },
  publishBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  publishBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  btnDisabled:    { opacity: 0.5 },
  publishedBox: {
    backgroundColor: '#14532d',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#166534',
  },
  publishedTitle: { color: '#86efac', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  publishedSub:   { color: '#bbf7d0', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  shareBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 24,
    marginBottom: 10,
  },
  shareBtnText:  { color: '#ffffff', fontWeight: '700' },
  unpublishBtn:  {},
  unpublishText: { color: '#86efac', fontSize: 13 },
  doneBtn:       { alignItems: 'center', paddingVertical: 14 },
  doneBtnText:   { color: '#6b7280', fontSize: 15 },
})
