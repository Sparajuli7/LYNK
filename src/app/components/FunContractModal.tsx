import { useState } from 'react'
import { useNavigate } from 'react-router'
import { format } from 'date-fns'
import { motion } from 'motion/react'
import { formatMoney } from '@/lib/utils/formatters'
import { Dialog, DialogContent } from './ui/dialog'

export interface FunContractParticipant {
  id: string
  name: string
  avatarUrl?: string | null
}

interface FunContractModalProps {
  open: boolean
  onClose: () => void
  title: string
  wager: { money?: number | null; punishment?: string | null }
  validUntil: string
  participants: FunContractParticipant[]
  groupName?: string
  detailPath: string
}

export function FunContractModal({
  open,
  onClose,
  title,
  wager,
  validUntil,
  participants,
  groupName,
  detailPath,
}: FunContractModalProps) {
  const navigate = useNavigate()
  const [signed, setSigned] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState(false)

  const handleSign = (id: string) => {
    setSigned((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSend = () => {
    setSent(true)
    setTimeout(() => {
      onClose()
      navigate(detailPath)
    }, 1200)
  }

  const wagerParts = [
    wager.money ? formatMoney(wager.money) : null,
    wager.punishment ?? null,
  ].filter(Boolean)
  const wagerText = wagerParts.join(' + ')

  let validDate: Date | null = null
  try {
    validDate = new Date(validUntil)
    if (isNaN(validDate.getTime())) validDate = null
  } catch {
    validDate = null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-sm p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 space-y-5 mx-2"
        >
          {/* Header stamp */}
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted">
              Official Forfeit Contract
            </p>
            <div className="h-px bg-[#2a2a2a]" />
          </div>

          {/* Claim */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted mb-1">The Claim</p>
            <p className="text-white font-bold text-base leading-snug">{title}</p>
          </div>

          {/* Wager */}
          {wagerText && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted mb-1">Wager</p>
              <p className="text-accent-green font-black text-2xl">{wagerText}</p>
            </div>
          )}

          {/* Valid until */}
          {validDate && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted mb-1">Valid Until</p>
              <p className="text-white font-bold text-sm">
                {format(validDate, "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          )}

          {/* Signatures */}
          {participants.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text-muted mb-3">Signatures</p>
              <div className="space-y-2">
                {participants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {p.avatarUrl ? (
                        <img
                          src={p.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-[#2a2a2a]"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-bold text-text-muted border border-[#2a2a2a]">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm font-semibold text-white">{p.name}</span>
                    </div>
                    <button
                      onClick={() => handleSign(p.id)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all ${
                        signed.has(p.id)
                          ? 'bg-accent-green text-white'
                          : 'border border-[#2a2a2a] text-text-muted hover:border-accent-green hover:text-accent-green'
                      }`}
                    >
                      {signed.has(p.id) ? '✓ Signed' : 'Sign'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-[#2a2a2a]" />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={sent}
            className="w-full py-4 rounded-xl font-black text-sm bg-accent-green text-white transition-opacity disabled:opacity-80"
          >
            {sent ? '✓ Sent!' : groupName ? `Send to ${groupName}` : 'Send to Group'}
          </button>

          {/* Fine print */}
          <p className="text-center text-[10px] text-text-muted">
            Not legally binding · For fun only
          </p>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
