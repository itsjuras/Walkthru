import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { propertiesApi } from '../../api/properties'

export default function Step1_Details() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function handleNext(e) {
    e.preventDefault()
    setLoading(true)
    try {
      let propertyId = id
      if (!id || id === 'new') {
        const res = await propertiesApi.create(form)
        propertyId = res.data.id
      } else {
        await propertiesApi.update(id, form)
      }
      navigate(`/properties/${propertyId}/wizard/floorplan`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Property Details</h2>
      <p className="text-gray-400 mb-8">Start with the basics — you can update these any time.</p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <form onSubmit={handleNext} className="space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Property title</label>
          <input
            value={form.title} onChange={set('title')} required
            placeholder="e.g. Modern Downtown Condo"
            className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Full address</label>
          <input
            value={form.address} onChange={set('address')} required
            placeholder="123 Main St, City, State ZIP"
            className="w-full px-4 py-3 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-50 transition"
        >
          {loading ? 'Saving...' : 'Next: Upload Floor Plan →'}
        </button>
      </form>
    </div>
  )
}
