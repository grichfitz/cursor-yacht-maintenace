import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

type ToastKind = "error" | "info"

type ToastItem = {
  id: string
  kind: ToastKind
  title: string
  message?: string
}

type ToastApi = {
  push: (t: Omit<ToastItem, "id">) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

function randomId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function AdminToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = randomId()
    const item: ToastItem = { id, ...t }
    setToasts((prev) => [item, ...prev].slice(0, 4))
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4500)
  }, [])

  const api = useMemo<ToastApi>(() => {
    return {
      push,
      error: (title: string, message?: string) => push({ kind: "error", title, message }),
      info: (title: string, message?: string) => push({ kind: "info", title, message }),
    }
  }, [push])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="admin-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`admin-toast ${t.kind === "error" ? "error" : ""}`.trim()}>
            <div className="admin-toast-title">{t.title}</div>
            {t.message ? <div className="admin-toast-body">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useAdminToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useAdminToast must be used within AdminToastProvider")
  return ctx
}

