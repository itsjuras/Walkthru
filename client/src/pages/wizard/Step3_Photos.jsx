/**
 * Step 3: Guided per-room photo upload.
 *
 * Shows one room at a time. For each room: North/South/East/West walls are required;
 * Floor/Ceiling are optional. All 4 required walls must be uploaded to advance.
 *
 * If no rooms exist yet (user skipped Step 2), shows a quick room-creation form
 * so the wizard is never broken.
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { roomsApi } from '../../api/properties'

const WALLS = [
  { dir: 'north',   label: 'North Wall ↑',      tip: 'Face NORTH — the main wall or window side.',     required: true  },
  { dir: 'south',   label: 'South Wall ↓',      tip: 'Turn 180°. Face SOUTH — typically the doorway.', required: true  },
  { dir: 'east',    label: 'East Wall →',        tip: 'Face EAST (to your right).',                     required: true  },
  { dir: 'west',    label: 'West Wall ←',        tip: 'Face WEST (to your left).',                      required: true  },
  { dir: 'floor',   label: 'Floor (optional)',   tip: 'Point straight down from chest height.',          required: false },
  { dir: 'ceiling', label: 'Ceiling (optional)', tip: 'Point straight up.',                              required: false },
]

// ── WallSlot ──────────────────────────────────────────────────────────────────

function WallSlot({ wall, roomId, initialUrl, onUploaded }) {
  const [preview, setPreview] = useState(initialUrl || null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const localUrl = URL.createObjectURL(file)
    setPreview(localUrl)
    setUploading(true)
    setUploadError(null)
    try {
      await roomsApi.uploadWallPhoto(roomId, wall.dir, file)
      onUploaded(wall.dir)
    } catch (err) {
      setUploadError('Upload failed — tap to retry')
      setPreview(null)
    } finally {
      setUploading(false)
    }
  }

  const inputId = `wall-${roomId}-${wall.dir}`

  return (
    <div className="bg-gray-800 rounded-xl p-4 flex gap-4 items-start">
      <div
        className="w-24 h-24 flex-shrink-0 rounded-lg bg-gray-700 overflow-hidden cursor-pointer relative"
        onClick={() => document.getElementById(inputId).click()}
      >
        {preview ? (
          <img src={preview} alt={wall.label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500 text-3xl select-none">+</div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs text-white">
            Uploading...
          </div>
        )}
        <input
          id={inputId}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-white">{wall.label}</p>
          {preview && !uploading && (
            <span className="text-green-400 text-xs">✓</span>
          )}
          {uploadError && (
            <span className="text-red-400 text-xs">{uploadError}</span>
          )}
        </div>
        <p className="text-sm text-gray-400">{wall.tip}</p>
        <p className="text-xs text-gray-600 mt-1">Wide-angle lens if available · All lights on · No people</p>
      </div>
    </div>
  )
}

// ── NoRooms quick-add ─────────────────────────────────────────────────────────

function NoRoomsPrompt({ propertyId, onRoomsCreated }) {
  const [names, setNames] = useState(['Living Room', 'Kitchen', 'Bedroom'])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  function addName() {
    const n = input.trim()
    if (!n) return
    setNames(prev => [...prev, n])
    setInput('')
  }

  async function handleCreate() {
    setSaving(true)
    const created = []
    for (let i = 0; i < names.length; i++) {
      const res = await roomsApi.create(propertyId, { name: names[i], order: i })
      created.push(res.data)
    }
    onRoomsCreated(created)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="font-semibold text-white mb-2">No rooms found</h3>
      <p className="text-sm text-gray-400 mb-4">
        It looks like you skipped the floor plan step. Add room names here and we'll set them up for you.
      </p>

      <div className="space-y-1 mb-3">
        {names.map((n, i) => (
          <div key={i} className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-1.5">
            <span className="text-sm text-white flex-1">{n}</span>
            <button
              onClick={() => setNames(prev => prev.filter((_, idx) => idx !== i))}
              className="text-xs text-red-400 hover:text-red-300"
            >✕</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addName())}
          placeholder="Add a room..."
          className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={addName}
          disabled={!input.trim()}
          className="px-4 py-2 bg-gray-600 rounded-lg text-sm hover:bg-gray-500 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      <button
        onClick={handleCreate}
        disabled={saving || names.length === 0}
        className="w-full py-2.5 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-40 transition"
      >
        {saving ? 'Creating rooms...' : `Start with ${names.length} room${names.length !== 1 ? 's' : ''}`}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Step3_Photos() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rooms, setRooms] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [uploaded, setUploaded] = useState({})   // { [dir]: true } for current room
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    roomsApi.list(id).then(res => {
      setRooms(res.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <p className="text-gray-500">Loading rooms...</p>

  if (rooms.length === 0) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Photo Upload</h2>
        <NoRoomsPrompt
          propertyId={id}
          onRoomsCreated={(created) => {
            setRooms(created)
            setCurrentIdx(0)
            setUploaded({})
          }}
        />
      </div>
    )
  }

  const room = rooms[currentIdx]

  // Pre-populate uploaded state from existing wall records
  const existingWallMap = {}
  if (room.walls) {
    room.walls.forEach(w => { if (w.photoUrl) existingWallMap[w.direction.toLowerCase()] = true })
  }
  const effectiveUploaded = { ...existingWallMap, ...uploaded }

  const required = WALLS.filter(w => w.required)
  const allRequiredDone = required.every(w => effectiveUploaded[w.dir])

  function handleNext() {
    if (currentIdx < rooms.length - 1) {
      setCurrentIdx(i => i + 1)
      setUploaded({})
    } else {
      navigate(`/properties/${id}/wizard/review`)
    }
  }

  const nextRoomName = rooms[currentIdx + 1]?.name

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1">Photo Upload</h2>

      {/* Room progress */}
      <div className="flex items-center gap-2 mb-1">
        <p className="text-gray-400">
          Room {currentIdx + 1} of {rooms.length}:{' '}
          <span className="text-white font-semibold">{room.name}</span>
        </p>
      </div>

      {/* Room dots */}
      <div className="flex gap-1.5 mb-6">
        {rooms.map((r, i) => (
          <div
            key={r.id}
            className={`h-1.5 rounded-full transition-all ${
              i < currentIdx ? 'bg-green-500 flex-1' :
              i === currentIdx ? 'bg-blue-500 flex-1' :
              'bg-gray-700 flex-1'
            }`}
          />
        ))}
      </div>

      <p className="text-gray-500 text-sm mb-6">
        Stand in the center of the room and take one photo per direction.
      </p>

      <div className="space-y-3 mb-8">
        {WALLS.map(wall => (
          <WallSlot
            key={wall.dir}
            wall={wall}
            roomId={room.id}
            initialUrl={room.walls?.find(w => w.direction.toLowerCase() === wall.dir)?.photoUrl}
            onUploaded={(dir) => setUploaded(u => ({ ...u, [dir]: true }))}
          />
        ))}
      </div>

      <button
        onClick={handleNext}
        disabled={!allRequiredDone}
        className="w-full py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {currentIdx < rooms.length - 1
          ? `Next Room: ${nextRoomName} →`
          : 'Review & Generate →'}
      </button>

      {!allRequiredDone && (
        <p className="text-center text-gray-500 text-sm mt-3">
          Upload all 4 required wall photos to continue
        </p>
      )}
    </div>
  )
}
