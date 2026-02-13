import { useEffect, useRef } from "react"

export function useFocusReload(reload: () => void, enabled = true) {
  const lastRunAtRef = useRef(0)
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    // Prevent "resume lag": avoid hammering reload on quick alt-tab/app switch.
    const COOLDOWN_MS = 60_000

    const maybeReload = () => {
      const now = Date.now()
      if (inFlightRef.current) return
      if (now - lastRunAtRef.current < COOLDOWN_MS) return
      lastRunAtRef.current = now
      inFlightRef.current = true
      Promise.resolve(reload()).finally(() => {
        inFlightRef.current = false
      })
    }

    const onFocus = () => maybeReload()
    const onVisibility = () => {
      if (document.visibilityState === "visible") maybeReload()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [reload, enabled])
}

