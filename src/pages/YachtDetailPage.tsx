import { useNavigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

export default function YachtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [location, setLocation] = useState("")

  useEffect(() => {
    if (!id) return

    supabase
      .from("yachts")
      .select("name, make_model, location")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name)
        setMakeModel(data.make_model ?? "")
        setLocation(data.location ?? "")
      })
  }, [id])

  const save = async () => {
    if (!id) return

    await supabase
      .from("yachts")
      .update({
        name,
        make_model: makeModel || null,
        location: location || null,
      })
      .eq("id", id)

    navigate(-1)
  }

  if (!id) return null

  return (
    <div className="app-content">

      {/* Top Bar (match CategoryEditor) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
          marginTop: -6,
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          ← Back
        </button>

        <button
          onClick={save}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Save
        </button>
      </div>

      <hr />

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Yacht Editor</div>

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

      <hr />

      {/* Assigned Groups — subtle pill like Assigned Categories */}

      <div style={{ marginTop: 8 }}>
        <button
          onClick={() => navigate(`/yachts/${id}/groups`)}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          Assigned Groups
        </button>
      </div>

    </div>
  )
}
