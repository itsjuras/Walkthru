const express = require('express')
const Anthropic = require('@anthropic-ai/sdk')
const fetch = require('node:http').request ? require('node:https') : null
const requireAuth = require('../middleware/auth')

const router = express.Router()
router.use(requireAuth)

const client = new Anthropic()

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001'

async function imageToBase64(url) {
  // If local path, prepend server base URL
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`

  const res = await fetch_url(fullUrl)
  const buffer = Buffer.from(res)
  return buffer.toString('base64')
}

function fetch_url(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? require('https') : require('http')
    lib.get(url, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

function feetInchesToMeters(str) {
  // Parses strings like "15'-5"" or "10'-5"" or "11'-1""
  const match = str.match(/(\d+)'[–\-](\d+)"?/)
  if (match) {
    const feet = parseInt(match[1])
    const inches = parseInt(match[2])
    return Math.round(((feet * 12 + inches) * 0.0254) * 100) / 100
  }
  // Try plain number (already meters)
  const plain = parseFloat(str)
  return isNaN(plain) ? null : plain
}

// POST /api/extract-rooms
router.post('/extract-rooms', async (req, res) => {
  const { floorPlanUrl, imageBase64, mediaType: clientMediaType } = req.body
  if (!floorPlanUrl && !imageBase64) return res.status(400).json({ message: 'floorPlanUrl or imageBase64 required' })

  try {
    let base64, mediaType
    if (imageBase64) {
      // Client sent image directly — no network fetch needed
      base64 = imageBase64
      mediaType = clientMediaType || 'image/jpeg'
    } else {
      base64 = await imageToBase64(floorPlanUrl)
      mediaType = floorPlanUrl.match(/\.png$/i) ? 'image/png' : 'image/jpeg'
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
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
        },
      ],
    })

    const text = response.content[0].text.trim()

    let rooms
    try {
      rooms = JSON.parse(text)
    } catch {
      // Strip any accidental markdown fences
      const cleaned = text.replace(/```json?|```/g, '').trim()
      rooms = JSON.parse(cleaned)
    }

    // Validate and clamp values
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
