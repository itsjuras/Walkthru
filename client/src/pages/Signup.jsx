import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/properties'
import { useAuthStore } from '../store/authStore'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.signup(name, email, password)
      setAuth(res.data.token, res.data.user)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Create your account</h2>
        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Full name" required
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Email" required
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)" required minLength={8}
            className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 transition"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-gray-400 text-sm mt-4 text-center">
          Already have an account? <Link to="/login" className="text-blue-400 hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  )
}
