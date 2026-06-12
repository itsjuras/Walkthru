const express = require('express')
const { PrismaClient } = require('@prisma/client')
const multer = require('multer')
const path = require('path')
const requireAuth = require('../middleware/auth')
const { uploadFile } = require('../services/storage')

const router = express.Router()
const prisma = new PrismaClient()

// Memory storage — file bytes handed off to storage service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

router.use(requireAuth)

// GET /api/properties/:propertyId/rooms
router.get('/properties/:propertyId/rooms', async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { propertyId: req.params.propertyId },
    orderBy: { order: 'asc' },
    include: { walls: true },
  })
  res.json(rooms)
})

// POST /api/properties/:propertyId/rooms
router.post('/properties/:propertyId/rooms', async (req, res) => {
  const { name, ceilingHeightM, realWidthM, realDepthM, polygonPoints, order } = req.body
  const room = await prisma.room.create({
    data: {
      propertyId: req.params.propertyId,
      name: name || 'Unnamed Room',
      ceilingHeightM: ceilingHeightM || 2.4,
      realWidthM: realWidthM || 4.0,
      realDepthM: realDepthM || 4.0,
      polygonPoints: polygonPoints || [],
      order: order ?? 0,
    },
  })
  res.status(201).json(room)
})

// PUT /api/rooms/:id
router.put('/rooms/:id', async (req, res) => {
  const allowed = ['name', 'ceilingHeightM', 'realWidthM', 'realDepthM', 'polygonPoints', 'order', 'worldX', 'worldY', 'worldZ']
  const data = {}
  for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k]
  const room = await prisma.room.update({ where: { id: req.params.id }, data })
  res.json(room)
})

// DELETE /api/rooms/:id
router.delete('/rooms/:id', async (req, res) => {
  await prisma.room.delete({ where: { id: req.params.id } })
  res.json({ deleted: true })
})

// PUT /api/rooms/:id/walls/:direction  — upload wall photo
router.put('/rooms/:id/walls/:direction', upload.single('photo'), async (req, res) => {
  const direction = req.params.direction.toUpperCase()
  const validDirs = ['NORTH', 'SOUTH', 'EAST', 'WEST', 'FLOOR', 'CEILING']
  if (!validDirs.includes(direction)) return res.status(400).json({ message: 'Invalid direction' })
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

  try {
    const ext = path.extname(req.file.originalname) || '.jpg'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    const photoUrl = await uploadFile(req.file.buffer, filename, req.file.mimetype, 'walls')

    const wall = await prisma.wall.upsert({
      where: { roomId_direction: { roomId: req.params.id, direction } },
      update: { photoUrl },
      create: { roomId: req.params.id, direction, photoUrl },
    })
    res.json(wall)
  } catch (err) {
    res.status(500).json({ message: 'Upload failed: ' + err.message })
  }
})

// DELETE /api/rooms/:id/walls/:direction
router.delete('/rooms/:id/walls/:direction', async (req, res) => {
  const direction = req.params.direction.toUpperCase()
  await prisma.wall.deleteMany({ where: { roomId: req.params.id, direction } })
  res.json({ deleted: true })
})

module.exports = router
