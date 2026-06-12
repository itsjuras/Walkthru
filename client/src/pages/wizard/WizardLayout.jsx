import { Outlet, useParams, useLocation, Link } from 'react-router-dom'

const STEPS = [
  { key: 'details',   label: 'Details',    path: 'details' },
  { key: 'floorplan', label: 'Floor Plan', path: 'floorplan' },
  { key: 'photos',    label: 'Photos',     path: 'photos' },
  { key: 'review',    label: 'Review',     path: 'review' },
]

export default function WizardLayout() {
  const { id } = useParams()
  const { pathname } = useLocation()

  const currentStep = STEPS.findIndex(s => pathname.includes(s.key))

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <h1 className="text-lg font-bold">Set Up Property</h1>
        <span className="text-gray-600 text-sm">Step {currentStep + 1} of {STEPS.length}</span>
      </header>

      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-800">
        <div
          className="h-1 bg-blue-600 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step tabs */}
      <div className="flex border-b border-gray-800">
        {STEPS.map((step, i) => {
          const done = i < currentStep
          const active = i === currentStep
          return (
            <div
              key={step.key}
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                active ? 'text-white border-b-2 border-blue-500'
                : done ? 'text-blue-400 cursor-pointer hover:text-blue-300'
                : 'text-gray-600'
              }`}
            >
              {done ? (
                <Link to={`/properties/${id}/wizard/${step.path}`}>{step.label}</Link>
              ) : (
                step.label
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Outlet />
      </div>
    </div>
  )
}
