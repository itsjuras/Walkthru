/**
 * Storage service — S3 when AWS env vars are set, local disk otherwise.
 *
 * Usage:
 *   const { uploadFile } = require('./storage')
 *   const url = await uploadFile(buffer, originalname, mimetype, 'walls')
 *
 * Local dev: files are written to server/uploads/<folder>/ and served via
 *   the /uploads static route in index.js. Returned URL is a /uploads/... path.
 *
 * S3: returned URL is the public https://... object URL.
 *   Bucket must have public-read ACL or a bucket policy allowing GetObject.
 */

const path = require('path')
const fs = require('fs')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const useS3 = !!(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET
)

let s3Client
if (useS3) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })
  console.log(`[storage] Using S3 bucket: ${process.env.S3_BUCKET}`)
} else {
  console.log('[storage] Using local disk storage (set AWS env vars to enable S3)')
}

/**
 * @param {Buffer} buffer     — file contents
 * @param {string} filename   — unique filename with extension (caller's responsibility)
 * @param {string} mimetype   — e.g. 'image/jpeg'
 * @param {string} folder     — subfolder within uploads, e.g. 'walls' or 'floorplans'
 * @returns {Promise<string>} — absolute URL (S3 https://...) or local path (/uploads/...)
 */
async function uploadFile(buffer, filename, mimetype, folder = 'uploads') {
  if (useS3) {
    const key = `${folder}/${filename}`
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimetype,
    }))
    const region = process.env.AWS_REGION || 'us-east-1'
    return `https://${process.env.S3_BUCKET}.s3.${region}.amazonaws.com/${key}`
  }

  // Local disk fallback
  const dir = path.join(__dirname, '../../uploads', folder)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, filename), buffer)
  return `/uploads/${folder}/${filename}`
}

module.exports = { uploadFile, useS3 }
