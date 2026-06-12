import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user:  null,
      setAuth:   (token, user) => set({ token, user }),
      clearAuth: ()            => set({ token: null, user: null }),
    }),
    {
      name: 'pm-auth',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)
