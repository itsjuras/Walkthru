import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Pages
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import PropertyNew from './pages/PropertyNew'
import Viewer from './pages/Viewer'

// Wizard steps
import WizardLayout from './pages/wizard/WizardLayout'
import Step1_Details from './pages/wizard/Step1_Details'
import Step2_FloorPlan from './pages/wizard/Step2_FloorPlan'
import Step3_Photos from './pages/wizard/Step3_Photos'
import Step4_Review from './pages/wizard/Step4_Review'

function ProtectedRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/tour/:token" element={<Viewer />} />

      {/* Protected — realtor dashboard */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/properties/new" element={<ProtectedRoute><PropertyNew /></ProtectedRoute>} />

      {/* Wizard */}
      <Route path="/properties/:id/wizard" element={<ProtectedRoute><WizardLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="details" replace />} />
        <Route path="details" element={<Step1_Details />} />
        <Route path="floorplan" element={<Step2_FloorPlan />} />
        <Route path="photos" element={<Step3_Photos />} />
        <Route path="review" element={<Step4_Review />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
