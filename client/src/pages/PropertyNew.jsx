import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { propertiesApi } from '../api/properties'

/**
 * Creates a blank property and immediately redirects into the wizard.
 * This way the wizard always has a real property ID to work with.
 */
export default function PropertyNew() {
  const navigate = useNavigate()

  useEffect(() => {
    propertiesApi.create({ title: 'New Property', address: '' })
      .then(res => navigate(`/properties/${res.data.id}/wizard/details`, { replace: true }))
      .catch(() => navigate('/dashboard'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
      Creating property...
    </div>
  )
}
