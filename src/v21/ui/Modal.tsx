import React from "react"

export function Modal({
  title,
  children,
  onClose,
  footer,
  width = 720,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
  width?: number
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
        zIndex: 1000,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "85vh",
          overflow: "auto",
          padding: 14,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div style={{ height: 10 }} />
        {children}
        {footer ? (
          <>
            <div style={{ height: 12 }} />
            {footer}
          </>
        ) : null}
      </div>
    </div>
  )
}

