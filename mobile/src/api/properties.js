import api from './client'
import * as FileSystem from 'expo-file-system'
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

export const authApi = {
  login:  (email, password)       => api.post('/auth/login',  { email, password }),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }),
}

export const propertiesApi = {
  list:    ()          => api.get('/properties'),
  get:     (id)        => api.get(`/properties/${id}`),
  create:  (data)      => api.post('/properties', data),
  update:  (id, data)  => api.put(`/properties/${id}`, data),
  delete:  (id)        => api.delete(`/properties/${id}`),
  publish: (id)        => api.post(`/properties/${id}/publish`),
}

export const roomsApi = {
  list:   (propertyId) => api.get(`/properties/${propertyId}/rooms`),
  create: (propertyId, data) => api.post(`/properties/${propertyId}/rooms`, data),
  update: (id, data)   => api.put(`/rooms/${id}`, data),
  delete: (id)         => api.delete(`/rooms/${id}`),

  uploadWallPhoto: async (roomId, direction, imageUri, ext = 'jpg') => {
    const formData = new FormData()
    formData.append('photo', {
      uri: imageUri,
      type: ext === 'png' ? 'image/png' : 'image/jpeg',
      name: `${direction}.${ext}`,
    })
    return api.put(`/rooms/${roomId}/walls/${direction}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteWall: (roomId, direction) =>
    api.delete(`/rooms/${roomId}/walls/${direction}`),
}

export const extractApi = {
  extractRooms: async (imageUri) => {
    console.log('[extract] starting, imageUri:', imageUri)

    let compressed
    try {
      compressed = await manipulateAsync(
        imageUri,
        [{ resize: { width: 1024 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      )
      console.log('[extract] compressed uri:', compressed.uri)
    } catch (e) {
      console.error('[extract] manipulate failed:', e)
      throw e
    }

    let base64
    try {
      base64 = await FileSystem.readAsStringAsync(compressed.uri, {
        encoding: 'base64',
      })
      console.log('[extract] base64 length:', base64.length)
    } catch (e) {
      console.error('[extract] readAsString failed:', e)
      throw e
    }

    console.log('[extract] posting to server...')
    return api.post('/extract-rooms', { imageBase64: base64, mediaType: 'image/jpeg' })
  },
}

export const uploadApi = {
  floorPlan: async (imageUri, ext = 'jpg', propertyId) => {
    const formData = new FormData()
    formData.append('floorPlan', {
      uri: imageUri,
      type: ext === 'png' ? 'image/png' : 'image/jpeg',
      name: `floorplan.${ext}`,
    })
    return api.post(`/upload/floor-plan?propertyId=${propertyId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}
