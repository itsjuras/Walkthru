const express = require('express')
const multer  = require('multer')
const Anthropic = require('@anthropic-ai/sdk')
const requireAuth = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

const client  = new Anthropic()
const upload  = multer({ storage: multer.memoryStorage() })

// POST /api/extract-rooms  — accepts multipart/form-data with field "image"
router.post('/extract-rooms', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'image file required' })

  try {
    const base64    = req.file.buffer.toString('base64')
    const mediaType = req.file.mimetype || 'image/jpeg'

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `This is a real estate floor plan. Extract every labeled room with its dimensions.

Return ONLY a JSON array, no explanation, no markdown, no code fences. Example format:
[{"name":"Living Room","widthM":4.7,"depthM":3.2,"ceilingHeightM":2.4}]

Rules:
- Convert feet/inches to meters (e.g. 15'-5" = 4.70m, 10'-5" = 3.18m)
- Use standard ceiling height of 2.4m unless stated
- Include all rooms: bedroom, bathroom, kitchen, living room, dining room, closet, foyer, storage, balcony, etc.
- If a dimension is unclear, make a reasonable estimate based on the floor plan proportions
- name should be Title Case`,
          },
        ],
      }],
    })

    const text = response.content[0].text.trim()

    let rooms
    try {
      rooms = JSON.parse(text)
    } catch {
      rooms = JSON.parse(text.replace(/```json?|```/g, '').trim())
    }

    rooms = rooms.map(r => ({
      name: r.name || 'Room',
      widthM: Math.max(0.5, Math.min(50, parseFloat(r.widthM) || 3.0)),
      depthM: Math.max(0.5, Math.min(50, parseFloat(r.depthM) || 3.0)),
      ceilingHeightM: Math.max(2.0, Math.min(6.0, parseFloat(r.ceilingHeightM) || 2.4)),
    }))

    res.json({ rooms })
  } catch (err) {
    console.error('[extract-rooms]', err)
    res.status(500).json({ message: 'Extraction failed: ' + err.message })
  }
})

module.exports = router
