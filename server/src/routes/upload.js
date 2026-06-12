const express = require('express')
const multer = require('multer')
const path = require('path')
const { PrismaClient } = require('@prisma/client')
const requireAuth = require('../middleware/auth')
const { uploadFile } = require('../services/storage')

const router = express.Router()
const prisma = new PrismaClient()

// Memory storage — file bytes handed off to storage service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
})

// POST /api/upload/floor-plan?propertyId=xxx
router.post('/floor-plan', requireAuth, upload.single('floorPlan'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

  const ext = path.extname(req.file.originalname) || '.jpg'
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`

  try {
    const url = await uploadFile(req.file.buffer, filename, req.file.mimetype, 'floorplans')

    if (req.query.propertyId) {
      await prisma.property.updateMany({
        where: { id: req.query.propertyId, userId: req.userId },
        data: { floorPlanUrl: url },
      })
    }

    res.json({ url })
  } catch (err) {
    res.status(500).json({ message: 'Upload failed: ' + err.message })
  }
})

module.exports = router
