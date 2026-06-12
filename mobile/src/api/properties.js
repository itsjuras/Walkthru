import api from './client'

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
    const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator')
    const FileSystem = await import('expo-file-system')

    // Resize to 1024px wide — Claude doesn't need full resolution
    const compressed = await manipulateAsync(
      imageUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.8, format: SaveFormat.JPEG }
    )

    // Read as base64 using expo-file-system (FileReader doesn't exist in React Native)
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })

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
