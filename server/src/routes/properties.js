const express = require('express')
const { PrismaClient } = require('@prisma/client')
const requireAuth = require('../middleware/auth')
const sceneBuilder = require('../services/sceneBuilder')

const router = express.Router()
const prisma = new PrismaClient()

// All routes require auth
router.use(requireAuth)

// GET /api/properties
router.get('/', async (req, res) => {
  const properties = await prisma.property.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { rooms: { include: { walls: true } } },
  })
  res.json(properties)
})

// POST /api/properties
router.post('/', async (req, res) => {
  const { title, address } = req.body
  if (!title) return res.status(400).json({ message: 'title required' })
  const property = await prisma.property.create({
    data: { userId: req.userId, title, address: address || '' },
  })
  res.status(201).json(property)
})

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { rooms: { orderBy: { order: 'asc' }, include: { walls: true } } },
  })
  if (!property) return res.status(404).json({ message: 'Not found' })
  res.json(property)
})

// PUT /api/properties/:id
router.put('/:id', async (req, res) => {
  const allowed = ['title', 'address', 'floorPlanUrl', 'floorPlanScale', 'status']
  const data = {}
  for (const k of allowed) if (req.body[k] !== undefined) data[k] = req.body[k]

  const property = await prisma.property.updateMany({
    where: { id: req.params.id, userId: req.userId },
    data,
  })
  res.json({ updated: property.count })
})

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  await prisma.property.deleteMany({ where: { id: req.params.id, userId: req.userId } })
  res.json({ deleted: true })
})

// POST /api/properties/:id/publish  — trigger scene build
router.post('/:id/publish', async (req, res) => {
  const property = await prisma.property.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { rooms: { orderBy: { order: 'asc' }, include: { walls: true } } },
  })
  if (!property) return res.status(404).json({ message: 'Not found' })

  // Mark as processing
  await prisma.property.update({
    where: { id: property.id },
    data: { status: 'PROCESSING' },
  })

  try {
    const sceneData = await sceneBuilder.build(property)
    const updated = await prisma.property.update({
      where: { id: property.id },
      data: { status: 'PUBLISHED', sceneData, publishedAt: new Date() },
    })
    res.json({ shareToken: updated.shareToken, sceneData })
  } catch (err) {
    await prisma.property.update({ where: { id: property.id }, data: { status: 'DRAFT' } })
    res.status(500).json({ message: 'Scene build failed: ' + err.message })
  }
})

module.exports = router
