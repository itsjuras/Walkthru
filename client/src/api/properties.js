import api from './client'

export const shareApi = {
  getByToken: (token) => api.get(`/share/${token}`),
}
