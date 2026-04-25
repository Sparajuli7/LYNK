import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X } from 'lucide-react'

interface RolePickerSheetProps {
  open: boolean
  onClose: () => void
  memberName: string
  currentRole: 'owner' | 'admin' | 'bet_maker' | 'member'
  onRoleChange: (role: 'admin' | 'bet_maker' | 'member') => void
  isOwner: boolean
}

const ROLES = [
  {
    key: 'admin' as const,
    label: 'ADMIN',
    description: 'Can create bets, manage members, and edit group',
  },
  {
    key: 'bet_maker' as const,
    label: 'BET MAKER',
    description: 'Can create bets and join bets',
  },
  {
    key: 'member' as const,
    label: 'MEMBER',
    description: 'Can join bets only',
  },
]

export function RolePickerSheet({
  open,
  onClose,
  memberName,
  currentRole,
  onRoleChange,
  isOwner,
}: RolePickerSheetProps) {
  const [selectedRole, setSelectedRole] = useState<'admin' | 'bet_maker' | 'member'>(
    currentRole === 'owner' ? 'admin' : currentRole
  )

  // Sync when sheet opens with a new currentRole
  useEffect(() => {
    if (open) {
      setSelectedRole(currentRole === 'owner' ? 'admin' : currentRole)
    }
  }, [open, currentRole])

  const canSave = !isOwner && selectedRole !== currentRole

  const handleSave = () => {
    if (!canSave) return
    onRoleChange(selectedRole)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Dimmed overlay */}
          <motion.div
            key="rp-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="rp-sheet"
            initial={{ y: '100%' }}
            animate={{ y: '0%' }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-bg rounded-t-[24px] border-t border-rider/20"
          >
            {/* Grabber */}
            <div className="flex justify-center mt-2.5 mb-1">
              <div className="w-10 h-1 rounded-full bg-[#333]" />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between px-5 mt-1 mb-4">
              <div>
                <h2 className="font-black italic text-xl tracking-[-0.04em] text-text">
                  MANAGE ROLE
                </h2>
                <p className="text-[12px] text-text-dim mt-0.5">
                  Change {memberName}'s permissions
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-text-dim" />
              </button>
            </div>

            {/* Role options or owner notice */}
            <div className="px-5 mt-4">
              {isOwner ? (
                <div className="bg-surface rounded-xl p-3.5 border-[1.5px] border-transparent">
                  <p className="text-[12px] text-warning font-bold">
                    This member is the group owner. Ownership can't be transferred.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {ROLES.map(({ key, label, description }) => {
                    const selected = selectedRole === key
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedRole(key)}
                        className={`w-full bg-surface rounded-xl p-3.5 flex items-center gap-3 border-[1.5px] text-left transition-all ${
                          selected
                            ? 'border-rider bg-rider/[0.06]'
                            : 'border-transparent'
                        }`}
                      >
                        {/* Radio circle */}
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            selected
                              ? 'bg-rider'
                              : 'bg-transparent border-2 border-[#444]'
                          }`}
                        >
                          {selected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>

                        {/* Content */}
                        <div>
                          <span className="font-black text-[13px] text-text">
                            {label}
                          </span>
                          <p className="text-[10px] text-text-dim mt-0.5">
                            {description}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="px-5 mt-5 mb-8">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`w-full bg-rider text-bg font-black text-[13px] py-3 rounded-xl tracking-[0.1em] transition-all ${
                  canSave ? '' : 'opacity-40'
                }`}
              >
                SAVE
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
