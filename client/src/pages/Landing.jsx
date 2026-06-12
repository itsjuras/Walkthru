import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white px-6">
      <h1 className="text-5xl font-bold mb-4 text-center">
        PropertyMapper
      </h1>
      <p className="text-xl text-gray-400 mb-2 text-center max-w-xl">
        Turn your floor plan and photos into an interactive 3D walkthrough — in minutes.
      </p>
      <p className="text-gray-500 mb-10 text-center max-w-lg">
        Give buyers a complete virtual tour. No special equipment. Just your phone and a floor plan.
      </p>
      <div className="flex gap-4">
        <Link
          to="/signup"
          className="px-8 py-3 bg-blue-600 rounded-lg font-semibold hover:bg-blue-500 transition"
        >
          Get Started Free
        </Link>
        <Link
          to="/login"
          className="px-8 py-3 bg-gray-800 rounded-lg font-semibold hover:bg-gray-700 transition"
        >
          Log In
        </Link>
      </div>
    </div>
  )
}
