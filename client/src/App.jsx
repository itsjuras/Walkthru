import { Routes, Route, Navigate } from 'react-router-dom'
import Viewer from './pages/Viewer'

export default function App() {
  return (
    <Routes>
      <Route path="/tour/:token" element={<Viewer />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
