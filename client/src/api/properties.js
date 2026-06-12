import api from './client'

export const propertiesApi = {
  list: () => api.get('/properties'),
  get: (id) => api.get(`/properties/${id}`),
  create: (data) => api.post('/properties', data),
  update: (id, data) => api.put(`/properties/${id}`, data),
  delete: (id) => api.delete(`/properties/${id}`),
  publish: (id) => api.post(`/properties/${id}/publish`),
  getByToken: (token) => api.get(`/share/${token}`),
}

export const roomsApi = {
  list: (propertyId) => api.get(`/properties/${propertyId}/rooms`),
  create: (propertyId, data) => api.post(`/properties/${propertyId}/rooms`, data),
  update: (id, data) => api.put(`/rooms/${id}`, data),
  delete: (id) => api.delete(`/rooms/${id}`),
  uploadWallPhoto: (roomId, direction, file) => {
    const form = new FormData()
    form.append('photo', file)
    form.append('direction', direction)
    return api.put(`/rooms/${roomId}/walls/${direction}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }),
  me: () => api.get('/auth/me'),
}
