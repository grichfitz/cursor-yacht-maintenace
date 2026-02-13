import { useEffect } from "react"

export function useFocusReload(reload: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onFocus = () => reload()
    const onVisibility = () => {
      if (document.visibilityState === "visible") reload()
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [reload, enabled])
}

