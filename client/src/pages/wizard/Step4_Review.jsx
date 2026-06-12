import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { propertiesApi } from '../../api/properties'

function CheckItem({ done, label, detail }) {
  return (
    <div className={`flex items-start gap-3 ${done ? 'text-green-400' : 'text-yellow-400'}`}>
      <span className="mt-0.5 text-base">{done ? '✓' : '○'}</span>
      <div>
        <p className="font-medium">{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}

export default function Step4_Review() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    propertiesApi.get(id).then(res => {
      setProperty(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleGenerate() {
    setPublishing(true)
    setError(null)
    try {
      const res = await propertiesApi.publish(id)
      navigate(`/tour/${res.data.shareToken}`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate walkthrough')
      setPublishing(false)
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  if (!property) return <p className="text-red-400">Could not load property.</p>

  const rooms = property.rooms || []
  const roomsWithPhotos = rooms.filter(r =>
    r.walls?.some(w => w.photoUrl)
  )
  const totalWallsWithPhotos = rooms.reduce((sum, r) =>
    sum + (r.walls?.filter(w => w.photoUrl).length ?? 0), 0
  )

  const checks = [
    {
      done: !!(property.title && property.address && property.title !== 'New Property'),
      label: 'Property details',
      detail: property.title && property.address ? `${property.title} · ${property.address}` : 'Title and address required',
    },
    {
      done: rooms.length > 0,
      label: 'Rooms defined',
      detail: rooms.length > 0
        ? `${rooms.length} room${rooms.length !== 1 ? 's' : ''}${property.floorPlanUrl ? ' (from floor plan)' : ''}`
        : 'Add at least one room in the Floor Plan step',
    },
    {
      done: roomsWithPhotos.length > 0,
      label: 'Wall photos uploaded',
      detail: totalWallsWithPhotos > 0
        ? `${totalWallsWithPhotos} photo${totalWallsWithPhotos !== 1 ? 's' : ''} across ${roomsWithPhotos.length} room${roomsWithPhotos.length !== 1 ? 's' : ''}`
        : 'Upload wall photos for each room in the Photos step',
    },
  ]

  const allReady = checks.every(c => c.done)

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Review & Generate</h2>
      <p className="text-gray-400 mb-8 text-sm">
        Check everything looks right, then generate your 3D walkthrough.
      </p>

      <div className="bg-gray-800 rounded-xl p-5 mb-6 space-y-4">
        {checks.map((c, i) => <CheckItem key={i} {...c} />)}
      </div>

      {!allReady && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 mb-6 text-sm text-yellow-300">
          {checks.filter(c => !c.done).map((c, i) => (
            <p key={i}>• {c.detail}</p>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={handleGenerate}
        disabled={publishing || !allReady}
        className="w-full py-4 bg-green-600 rounded-lg font-bold text-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {publishing ? 'Building walkthrough...' : 'Generate 3D Walkthrough'}
      </button>

      {!allReady && (
        <p className="text-center text-gray-500 text-sm mt-3">
          Complete the items above to generate
        </p>
      )}

      <p className="text-center text-gray-600 text-xs mt-4">
        You'll get a shareable link to add to your listing.
      </p>
    </div>
  )
}
