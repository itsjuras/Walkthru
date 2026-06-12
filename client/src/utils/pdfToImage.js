/**
 * Renders the first page of a PDF file to a PNG blob URL.
 * Uses pdfjs-dist with a CDN-hosted worker to avoid Vite worker config.
 * Scale 2.0 gives ~2× native resolution for crisp floor plan tracing.
 */

let configured = false

async function getPdfLib() {
  const pdfjsLib = await import('pdfjs-dist')
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
    configured = true
  }
  return pdfjsLib
}

export async function pdfToBlobUrl(file, scale = 2.0) {
  const pdfjsLib = await getPdfLib()
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(URL.createObjectURL(blob))
      else reject(new Error('Failed to render PDF page'))
    }, 'image/png')
  })
}
