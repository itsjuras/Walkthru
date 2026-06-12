import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { propertiesApi } from '../api/properties'
import Scene from '../components/Viewer3D/Scene'
import { isMobile } from '../utils/device'

function CopyLinkButton({ token }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(`${window.location.origin}/tour/${token}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="bg-black/60 hover:bg-black/80 text-white text-sm px-4 py-2 rounded-full transition"
    >
      {copied ? '✓ Link copied!' : 'Share link'}
    </button>
  )
}

export default function Viewer() {
  const { token } = useParams()
  const [property, setProperty] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const mobile = isMobile()

  useEffect(() => {
    propertiesApi.getByToken(token)
      .then(res => {
        setProperty(res.data)
        setLoading(false)
      })
      .catch(() => {
        setError('Tour not found or unavailable.')
        setLoading(false)
      })
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-gray-400">Loading tour...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <Scene sceneData={property.sceneData} />

      {/* Top bar: property info + share */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 pointer-events-none">
        <div className="bg-black/60 rounded-full px-4 py-2">
          <p className="text-white text-sm font-semibold leading-tight">{property.title}</p>
          <p className="text-gray-400 text-xs">{property.address}</p>
        </div>
        <div className="pointer-events-auto">
          <CopyLinkButton token={token} />
        </div>
      </div>

      {/* Desktop hint */}
      {!mobile && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full pointer-events-none">
          Click to look around · WASD to move · Esc to release cursor
        </div>
      )}

      {/* Mobile hint */}
      {mobile && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-4 py-2 rounded-full pointer-events-none">
          Left side: joystick · Right side: drag to look
        </div>
      )}
    </div>
  )
}
