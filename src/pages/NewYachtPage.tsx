import React, { useState } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"

export default function NewYachtPage() {
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [location, setLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Yacht name is required.")
      return
    }

    setSaving(true)

    const { data, error: insertError } = await supabase
      .from("yachts")
      .insert({
        name: trimmed,
        make_model: makeModel.trim() ? makeModel.trim() : null,
        location: location.trim() ? location.trim() : null,
      })
      .select("id")
      .single()

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    const newId = (data as any)?.id as string | undefined
    if (!newId) {
      setError("Yacht created, but no ID returned.")
      return
    }

    // Replace New Yacht page in history so Back goes to yachts list.
    navigate(`/apps/yachts/${newId}`, { replace: true })
  }

  return (
    <div className="screen">
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="primary-button"
        >
          ← Back
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>New Yacht</div>

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 12 }}>
          {error}
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <label>Make / Model:</label>
      <input
        value={makeModel}
        onChange={(e) => setMakeModel(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <label>Location:</label>
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleCreate}
          disabled={saving}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            color: "var(--text-primary)",
            padding: 0,
          }}
        >
          {saving ? "Creating…" : "Create"}
        </button>
      </div>
    </div>
  )
}

