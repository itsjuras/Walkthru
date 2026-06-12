/**
 * Step 2: Floor Plan Upload + Room Tracing
 *
 * Three sub-phases:
 *   1. Upload: drag/click to upload the floor plan image
 *   2. Trace:  TracerCanvas for scale calibration + polygon room drawing
 *   3. Fallback "manual rooms": shown when user has no floor plan (or skipped tracing)
 *              so at least one room exists before entering Step 3
 *
 * On "Next":
 *   - Uploads the image to /api/upload/floor-plan if a new file was selected
 *   - Updates property with floorPlanUrl + floorPlanScale
 *   - Creates new rooms (from tracer or manual list) via API
 *   - If returning user: existing rooms are preserved; new rooms are appended
 */

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import TracerCanvas from '../../components/FloorPlanTracer/TracerCanvas'
import { propertiesApi, roomsApi } from '../../api/properties'
import api from '../../api/client'
import { pdfToBlobUrl } from '../../utils/pdfToImage'

export default function Step2_FloorPlan() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Existing DB state
  const [existingRooms, setExistingRooms] = useState([])
  const [existingFloorPlanUrl, setExistingFloorPlanUrl] = useState(null)
  const [existingScale, setExistingScale] = useState(null)
  const [loading, setLoading] = useState(true)

  // Upload state
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)  // image blob URL for TracerCanvas
  const [pdfRendering, setPdfRendering] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  // Tracer output
  const [tracerData, setTracerData] = useState(null)  // { pixelsPerMeter, rooms }

  // Manual room fallback
  const [manualRooms, setManualRooms] = useState([])
  const [manualInput, setManualInput] = useState('')
  const [showManual, setShowManual] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Load existing property state on mount
  useEffect(() => {
    Promise.all([
      propertiesApi.get(id),
      roomsApi.list(id),
    ]).then(([propRes, roomsRes]) => {
      const prop = propRes.data
      if (prop.floorPlanUrl) {
        setExistingFloorPlanUrl(prop.floorPlanUrl)
        setPreviewUrl(prop.floorPlanUrl)
      }
      if (prop.floorPlanScale) setExistingScale(prop.floorPlanScale)
      setExistingRooms(roomsRes.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPdfError(null)

    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      setPdfRendering(true)
      try {
        const blobUrl = await pdfToBlobUrl(f)
        setPreviewUrl(blobUrl)
      } catch {
        setPdfError('Could not render PDF. Try saving it as a PNG or JPG instead.')
        setPreviewUrl(null)
      } finally {
        setPdfRendering(false)
      }
    } else {
      setPreviewUrl(URL.createObjectURL(f))
    }
  }

  function handleTracerChange(data) {
    setTracerData(data)
  }

  function addManualRoom() {
    const name = manualInput.trim()
    if (!name) return
    setManualRooms(prev => [...prev, { name, ceilingHeightM: 2.4, realWidthM: 4, realDepthM: 4 }])
    setManualInput('')
  }

  function removeManualRoom(i) {
    setManualRooms(prev => prev.filter((_, idx) => idx !== i))
  }

  // Rooms that will be created: from tracer (if floor plan shown) or manual list
  const newRoomsToCreate = previewUrl
    ? (tracerData?.rooms ?? [])
    : manualRooms

  // Total rooms after save: existing + new (only allow Next if at least one total)
  const totalRooms = existingRooms.length + newRoomsToCreate.length
  const canProceed = totalRooms > 0

  async function handleNext() {
    setSaving(true)
    setError(null)
    try {
      // 1. Upload floor plan image if a new file was selected
      let floorPlanUrl = existingFloorPlanUrl
      if (file) {
        const form = new FormData()
        form.append('floorPlan', file)
        const res = await api.post(`/upload/floor-plan?propertyId=${id}`, form)
        floorPlanUrl = res.data.url
      }

      // 2. Update property with floor plan URL + scale
      const scale = tracerData?.pixelsPerMeter ?? existingScale ?? null
      if (floorPlanUrl || scale) {
        const patch = {}
        if (floorPlanUrl) patch.floorPlanUrl = floorPlanUrl
        if (scale) patch.floorPlanScale = scale
        if (Object.keys(patch).length) await propertiesApi.update(id, patch)
      }

      // 3. Create new rooms (from tracer or manual list)
      for (let i = 0; i < newRoomsToCreate.length; i++) {
        const r = newRoomsToCreate[i]
        await roomsApi.create(id, {
          name: r.name,
          ceilingHeightM: r.ceilingHeightM ?? 2.4,
          realWidthM: r.realWidthM ?? 4.0,
          realDepthM: r.realDepthM ?? 4.0,
          polygonPoints: r.points ?? [],
          order: existingRooms.length + i,
        })
      }

      navigate(`/properties/${id}/wizard/photos`)
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-gray-500">Loading...</p>
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Floor Plan</h2>
      <p className="text-gray-400 mb-6 text-sm">
        Upload your floor plan, then trace each room to capture real-world dimensions.
        If you don't have one, add rooms manually below.
      </p>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {pdfError && <p className="text-red-400 text-sm mb-4">{pdfError}</p>}

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-blue-500 transition mb-4"
        onClick={() => document.getElementById('fp-input').click()}
      >
        {pdfRendering ? (
          <p className="text-blue-400 text-sm">Rendering PDF...</p>
        ) : previewUrl && !file ? (
          <div className="flex items-center gap-3 justify-center">
            <img src={previewUrl} alt="Floor plan" className="h-16 rounded object-contain" />
            <span className="text-gray-400 text-sm">Floor plan uploaded · click to replace</span>
          </div>
        ) : file ? (
          <p className="text-green-400 text-sm">{file.name} selected · will be uploaded on Next</p>
        ) : (
          <>
            <p className="text-gray-400 mb-1">Click to upload floor plan</p>
            <p className="text-gray-600 text-xs">JPG, PNG, or PDF · Max 20 MB</p>
          </>
        )}
        <input
          id="fp-input" type="file" accept="image/*,.pdf"
          className="hidden" onChange={handleFile}
        />
      </div>

      {/* TracerCanvas — shown when a floor plan image is selected/loaded */}
      {previewUrl && previewUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)|^blob:/i) && (
        <div className="mb-6">
          <TracerCanvas
            imageUrl={previewUrl}
            initialScale={existingScale}
            initialRooms={existingRooms}
            onChange={handleTracerChange}
          />
        </div>
      )}

      {/* Manual rooms section — always available as fallback */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowManual(v => !v)}
          className="text-sm text-gray-400 hover:text-white transition flex items-center gap-1"
        >
          <span>{showManual ? '▼' : '▶'}</span>
          {previewUrl ? 'Or add rooms manually (without tracing)' : 'Add rooms manually'}
        </button>

        {showManual && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualRoom())}
                placeholder="Room name (e.g. Kitchen)"
                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addManualRoom}
                disabled={!manualInput.trim()}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-500 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            {manualRooms.map((r, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span className="text-sm text-white flex-1">{r.name}</span>
                <button
                  type="button"
                  onClick={() => removeManualRoom(i)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing rooms summary (if returning to this step) */}
      {existingRooms.length > 0 && (
        <div className="mb-4 text-sm text-gray-500">
          {existingRooms.length} room{existingRooms.length > 1 ? 's' : ''} already saved
          {newRoomsToCreate.length > 0 && ` · ${newRoomsToCreate.length} new to add`}
        </div>
      )}

      {!canProceed && (
        <p className="text-sm text-yellow-500 mb-3">
          Add at least one room (trace on the floor plan or add manually) to continue.
        </p>
      )}

      <button
        onClick={handleNext}
        disabled={saving || !canProceed}
        className="w-full py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {saving ? 'Saving...' : `Next: Photo Upload → (${totalRooms} room${totalRooms !== 1 ? 's' : ''})`}
      </button>
    </div>
  )
}
