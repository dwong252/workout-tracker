import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function Header({ title, back, right, large = false }) {
  const navigate = useNavigate()

  return (
    <div className="page-header flex-shrink-0 bg-sys-bg/80 dark:bg-black/80 backdrop-blur-xl border-b border-sys-separator/60 dark:border-white/10">
      {large ? (
        /* Large title style */
        <div className="flex items-center justify-between px-4 pb-2">
          <div>
            {back && (
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-0.5 text-ios-blue mb-1 active:opacity-60"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
                <span className="text-sm font-medium">{typeof back === 'string' ? back : 'Back'}</span>
              </button>
            )}
            <h1 className="text-3xl font-bold text-sys-label dark:text-white tracking-tight">{title}</h1>
          </div>
          {right && <div className="flex-shrink-0">{right}</div>}
        </div>
      ) : (
        /* Compact navigation bar */
        <div className="flex items-center h-12 px-2">
          {back ? (
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-0.5 text-ios-blue px-2 active:opacity-60"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
              <span className="text-sm font-medium">{typeof back === 'string' ? back : 'Back'}</span>
            </button>
          ) : (
            <div className="w-20" />
          )}
          <h1 className="flex-1 text-center text-base font-semibold text-sys-label dark:text-white">
            {title}
          </h1>
          <div className="w-20 flex justify-end pr-2">{right}</div>
        </div>
      )}
    </div>
  )
}
