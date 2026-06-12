import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { propertiesApi } from '../api/properties'
import { useAuthStore } from '../store/authStore'

const STATUS_COLORS = {
  DRAFT:      'bg-yellow-500',
  PROCESSING: 'bg-blue-500',
  PUBLISHED:  'bg-green-500',
  ARCHIVED:   'bg-gray-500',
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  function copy(e) {
    e.preventDefault()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className="text-xs text-gray-400 hover:text-white border border-gray-700 rounded px-2 py-0.5 transition"
    >
      {copied ? '✓ Copied' : 'Copy link'}
    </button>
  )
}

export default function Dashboard() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(null)
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    propertiesApi.list().then(res => {
      setProperties(res.data)
      setLoading(false)
    })
  }, [])

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  async function handleDelete(p) {
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return
    setDeleting(p.id)
    try {
      await propertiesApi.delete(p.id)
      setProperties(prev => prev.filter(x => x.id !== p.id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">PropertyMapper</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition">
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">My Properties</h2>
          <Link
            to="/properties/new"
            className="px-5 py-2 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 transition"
          >
            + New Property
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg mb-2">No properties yet.</p>
            <p>Create your first 3D walkthrough to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {properties.map(p => {
              const tourUrl = `${window.location.origin}/tour/${p.shareToken}`
              return (
                <div key={p.id} className="bg-gray-900 rounded-xl p-5 hover:bg-gray-800 transition flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-lg leading-tight">{p.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full text-white flex-shrink-0 ml-2 ${STATUS_COLORS[p.status]}`}>
                      {p.status}
                    </span>
                  </div>

                  <p className="text-gray-400 text-sm mb-1">{p.address}</p>
                  <p className="text-gray-600 text-xs mb-4">
                    {p.rooms?.length ?? 0} room{(p.rooms?.length ?? 0) !== 1 ? 's' : ''}
                  </p>

                  <div className="flex gap-3 mt-auto flex-wrap items-center">
                    {p.status === 'DRAFT' || p.status === 'PROCESSING' ? (
                      <Link
                        to={`/properties/${p.id}/wizard/details`}
                        className="text-sm text-blue-400 hover:underline"
                      >
                        Continue setup →
                      </Link>
                    ) : (
                      <>
                        <Link
                          to={`/tour/${p.shareToken}`}
                          className="text-sm text-green-400 hover:underline"
                        >
                          View tour →
                        </Link>
                        <CopyButton text={tourUrl} />
                      </>
                    )}

                    <button
                      onClick={() => handleDelete(p)}
                      disabled={deleting === p.id}
                      className="text-xs text-gray-600 hover:text-red-400 transition ml-auto disabled:opacity-40"
                    >
                      {deleting === p.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
