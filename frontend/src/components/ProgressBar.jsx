export default function ProgressBar({ percent, className = '' }) {
  return (
    <div
      className={`w-full bg-slate-200 rounded-full overflow-hidden h-2.5 ${className}`}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-indigo-600 rounded-full transition-all duration-300"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}