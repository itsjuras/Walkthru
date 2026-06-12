import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native'
import { propertiesApi } from '../../api/properties'

export default function WizardStep1({ navigation, route }) {
  const { propertyId } = route.params
  const [title, setTitle]     = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)

  // Load existing values if returning to this step
  useEffect(() => {
    propertiesApi.get(propertyId).then(res => {
      const p = res.data
      if (p.title && p.title !== 'New Property') setTitle(p.title)
      if (p.address) setAddress(p.address)
    }).catch(() => {})
  }, [propertyId])

  async function handleNext() {
    if (!title.trim() || !address.trim()) {
      Alert.alert('Missing fields', 'Please enter both a title and an address.')
      return
    }
    setLoading(true)
    try {
      await propertiesApi.update(propertyId, { title: title.trim(), address: address.trim() })
      navigation.navigate('WizardStep2', { propertyId })
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Property title</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Modern Downtown Condo"
          placeholderTextColor="#4b5563"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Full address</Text>
        <TextInput
          style={styles.input}
          placeholder="123 Main St, City, State ZIP"
          placeholderTextColor="#4b5563"
          value={address}
          onChangeText={setAddress}
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleNext}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Saving...' : 'Next: Floor Plan →'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  inner:     { padding: 20, paddingTop: 28 },
  label:     { color: '#9ca3af', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
  },
  btn:         { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 32 },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#ffffff', fontSize: 16, fontWeight: '700' },
})
