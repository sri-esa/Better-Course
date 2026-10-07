import { Link } from 'react-router-dom'

export default function EmptyState() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
      <h2 className="text-xl font-semibold">No study plan yet</h2>
      <p className="text-slate-600 mt-2">
        Paste a YouTube playlist to create your first plan.
      </p>
      <Link
        to="/"
        className="inline-block mt-5 bg-indigo-600 text-white font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700"
      >
        Create a plan
      </Link>
    </div>
  )
}