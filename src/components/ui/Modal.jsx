import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// iOS-style sheet that slides up from the bottom
export default function Modal({ isOpen, onClose, title, children, fullHeight = false }) {
  const overlayRef = useRef(null)

  // Close on backdrop tap
  const handleBackdrop = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
    >
      <div
        className={[
          'ios-card w-full rounded-t-ios-xl shadow-ios-modal',
          'dark:bg-[#1C1C1E]',
          fullHeight ? 'h-[92vh]' : 'max-h-[85vh]',
          'flex flex-col',
        ].join(' ')}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        {/* Drag indicator */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-sys-label3 dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <h2 className="text-lg font-semibold text-sys-label dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-sys-bg3 dark:bg-white/10 active:opacity-70"
          >
            <X size={16} className="text-sys-label2 dark:text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 scroll-content">
          {children}
        </div>
      </div>
    </div>
  )
}

// Confirmation dialog
export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', destructive = true }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
      <div className="ios-card w-full max-w-sm p-5 dark:bg-[#1C1C1E]">
        <h3 className="text-base font-semibold text-sys-label dark:text-white mb-1">{title}</h3>
        <p className="text-sm text-sys-label2 dark:text-white/60 mb-5">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-11 rounded-ios bg-sys-bg3 dark:bg-white/10 text-sys-label dark:text-white font-semibold active:opacity-70"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`flex-1 h-11 rounded-ios font-semibold active:opacity-70 ${destructive ? 'bg-ios-red text-white' : 'bg-ios-blue text-white'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
