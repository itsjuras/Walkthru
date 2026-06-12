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

app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json())

// Serve uploaded files (dev only — use S3/CDN in production)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// Routes
app.use('/api/auth',        authRoutes)
app.use('/api/properties',  propertyRoutes)
// roomRoutes handles both /api/properties/:id/rooms AND /api/rooms/:id
app.use('/api',             roomRoutes)
app.use('/api/share',       shareRoutes)
app.use('/api/upload',      uploadRoutes)

// Health check
app.get('/api/health', (_, res) => res.json({ ok: true }))

// 404
app.use((_, res) => res.status(404).json({ message: 'Not found' }))

// Error handler
app.use((err, _, res, __) => {
  console.error(err)
  res.status(500).json({ message: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
