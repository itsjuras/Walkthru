import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, Share, ActivityIndicator, RefreshControl,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { propertiesApi } from '../api/properties'
import { useAuthStore } from '../store/authStore'
import { API_BASE_URL } from '../config'

const STATUS_COLORS = {
  DRAFT:      '#ca8a04',
  PROCESSING: '#2563eb',
  PUBLISHED:  '#16a34a',
  ARCHIVED:   '#4b5563',
}

function shareUrl(token) {
  // Derive viewer URL from server base
  const base = API_BASE_URL.replace('/api', '').replace(':3001', ':5173')
  return `${base}/tour/${token}`
}

export default function DashboardScreen({ navigation }) {
  const [properties, setProperties] = useState([])
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { user, clearAuth }         = useAuthStore()

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await propertiesApi.list()
      setProperties(res.data)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Reload whenever this screen comes into focus (e.g. returning from wizard)
  useFocusEffect(useCallback(() => { load() }, []))

  async function handleDelete(p) {
    Alert.alert(
      'Delete property',
      `Delete "${p.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await propertiesApi.delete(p.id)
            setProperties(prev => prev.filter(x => x.id !== p.id))
          },
        },
      ]
    )
  }

  async function handleShare(p) {
    try {
      await Share.share({ message: shareUrl(p.shareToken) })
    } catch {}
  }

  function handleLogout() {
    Alert.alert('Log out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: clearAuth },
    ])
  }

  async function handleNew() {
    try {
      const res = await propertiesApi.create({ title: 'New Property', address: '' })
      navigation.navigate('WizardStep1', { propertyId: res.data.id })
    } catch {
      Alert.alert('Error', 'Could not create property.')
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={properties}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#ffffff" />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]}</Text>
            <TouchableOpacity onPress={handleLogout}>
              <Text style={styles.logoutBtn}>Log out</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No properties yet</Text>
            <Text style={styles.emptyText}>Tap + to create your first 3D walkthrough</Text>
          </View>
        }
        renderItem={({ item: p }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle} numberOfLines={1}>{p.title}</Text>
                <Text style={styles.cardAddress} numberOfLines={1}>{p.address || 'No address'}</Text>
                <Text style={styles.cardMeta}>
                  {p.rooms?.length ?? 0} room{(p.rooms?.length ?? 0) !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[p.status] }]}>
                <Text style={styles.badgeText}>{p.status}</Text>
              </View>
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('WizardStep1', { propertyId: p.id })}
              >
                <Text style={styles.actionBtnText}>
                  {p.status === 'PUBLISHED' ? 'Edit' : 'Continue setup'}
                </Text>
              </TouchableOpacity>

              {p.status === 'PUBLISHED' && (
                <TouchableOpacity style={styles.actionBtnGreen} onPress={() => handleShare(p)}>
                  <Text style={styles.actionBtnText}>Share tour</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => handleDelete(p)} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={handleNew}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030712' },
  list:      { padding: 16, paddingBottom: 100 },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting:  { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  logoutBtn: { color: '#6b7280', fontSize: 14 },
  empty:     { alignItems: 'center', paddingTop: 80 },
  emptyTitle:{ color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptyText: { color: '#6b7280', fontSize: 14 },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTop:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  cardInfo:    { flex: 1, marginRight: 12 },
  cardTitle:   { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  cardAddress: { color: '#9ca3af', fontSize: 13, marginBottom: 3 },
  cardMeta:    { color: '#4b5563', fontSize: 12 },
  badge:       { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  badgeText:   { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtnGreen: {
    backgroundColor: '#14532d',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  deleteBtn:     { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 8 },
  deleteBtnText: { color: '#4b5563', fontSize: 13 },
  fab: {
    position: 'absolute', right: 20, bottom: 32,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#ffffff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
})
