const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()
const prisma = new PrismaClient()

// GET /api/share/:token  — public, no auth required
router.get('/:token', async (req, res) => {
  const property = await prisma.property.findUnique({
    where: { shareToken: req.params.token },
    select: {
      id: true,
      title: true,
      address: true,
      status: true,
      sceneData: true,
    },
  })

  if (!property) return res.status(404).json({ message: 'Tour not found' })
  if (property.status !== 'PUBLISHED') {
    return res.status(404).json({ message: 'Tour not yet published' })
  }

  res.json(property)
})

module.exports = router
