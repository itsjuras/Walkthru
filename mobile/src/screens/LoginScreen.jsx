import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native'
import { authApi } from '../api/properties'
import { useAuthStore } from '../store/authStore'

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)

  async function handleLogin() {
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      setAuth(res.data.token, res.data.user)
    } catch (err) {
      Alert.alert('Login failed', err.response?.data?.message || 'Check your email and password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>PropertyMapper</Text>
        <Text style={styles.subtitle}>Realtor portal</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Logging in...' : 'Log In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.link}>
          <Text style={styles.linkText}>No account? Sign up free</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  inner:     { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo:      { fontSize: 32, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 6 },
  subtitle:  { fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText:     { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  link:        { marginTop: 20, alignItems: 'center' },
  linkText:    { color: '#60a5fa', fontSize: 14 },
})
