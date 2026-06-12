require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const authRoutes      = require('./routes/auth')
const propertyRoutes  = require('./routes/properties')
const roomRoutes      = require('./routes/rooms')
const shareRoutes     = require('./routes/share')
const uploadRoutes    = require('./routes/upload')

const app = express()

// Allow localhost and any LAN IP (10.x, 192.168.x, 172.x) during development
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^https?:\/\/(localhost|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01]))/.test(origin)) {
      cb(null, true)
    } else {
      cb(new Error(`CORS: origin ${origin} not allowed`))
    }
  },
  credentials: true,
}))
app.use(express.json())

// Serve uploaded files (dev only — use S3/CDN in production)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Health check — must be registered before the room router which auth-guards /api/*
app.get('/api/health', (_, res) => res.json({ ok: true }))

// Routes
app.use('/api/auth',        authRoutes)
app.use('/api/properties',  propertyRoutes)
// roomRoutes handles both /api/properties/:id/rooms AND /api/rooms/:id
app.use('/api',             roomRoutes)
app.use('/api/share',       shareRoutes)
app.use('/api/upload',      uploadRoutes)

// 404
app.use((_, res) => res.status(404).json({ message: 'Not found' }))

// Error handler
app.use((err, _, res, __) => {
  console.error(err)
  res.status(500).json({ message: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
