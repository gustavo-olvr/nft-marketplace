import { dismissNotice, useNotices } from './notifications'
import { useRealtimeStatus } from './status'
import { Button } from '@/components/ui/button'

export function RealtimeFeedback() {
  const notices = useNotices()
  const status = useRealtimeStatus()

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:max-w-sm">
      <div aria-live="polite" role="status" className="flex flex-col gap-2">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="pointer-events-auto flex items-start justify-between gap-3 rounded border bg-background p-3 shadow"
          >
            <span>{notice.message}</span>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Dispensar aviso"
              onClick={() => dismissNotice(notice.id)}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      {status === 'disconnected' && (
        <p role="status" className="pointer-events-auto rounded border bg-background p-3 shadow">
          Conexão em tempo real interrompida. Tentando reconectar…
        </p>
      )}
    </div>
  )
}
