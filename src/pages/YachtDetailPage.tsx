import { useNavigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"
import React from "react";
import { isMissingRelationError, isRelationKnownMissing, rememberMissingRelation } from "../utils/supabaseRelations"

export default function YachtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useSession()

  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    if (!id) return

    supabase
      .from("yachts")
      .select("name")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setName(data.name)
      })
  }, [id, session])

  const save = async () => {
    if (!id) return
    setSaveError(null)
    setSaving(true)

    const { error } = await supabase
      .from("yachts")
      .update({
        name,
      })
      .eq("id", id)

    if (error) {
      setSaveError(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(-1)
  }

  const handleDelete = async () => {
    if (!id) return

    setDeleteError(null)

    const ok = window.confirm(
      "Delete this yacht?\n\nThis cannot be undone."
    )
    if (!ok) return

    setDeleting(true)

    if (isRelationKnownMissing("tasks")) {
      // Can't check references; let the DB enforce any constraints on delete.
    } else {
    const { data: yachtTasks, error: yachtTaskErr } = await supabase
      .from("tasks")
      .select("id")
      .eq("yacht_id", id)
      .limit(1)

    if (yachtTaskErr) {
      if (isMissingRelationError(yachtTaskErr)) {
        rememberMissingRelation("tasks")
        // Can't check references; let the DB enforce constraints on delete.
      } else {
      setDeleteError(yachtTaskErr.message)
      setDeleting(false)
      return
      }
    }

    const isReferenced = (yachtTasks?.length ?? 0) > 0

    if (isReferenced) {
      setDeleteError(
        "This yacht cannot be deleted because it is referenced by tasks."
      )
      setDeleting(false)
      return
    }
    }

    const { error: delErr } = await supabase.from("yachts").delete().eq("id", id)

    if (delErr) {
      setDeleteError(delErr.message)
      setDeleting(false)
      return
    }

    setDeleting(false)
    navigate("/apps/yachts", { replace: true })
  }

  if (!id) return null

  return (
    <div className="screen">

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
          type="button"
          onClick={() => navigate(-1)}
          className="primary-button"
        >
          ← Back
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

      {saveError && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {saveError}
        </div>
      )}

      <button
        type="button"
        className="cta-button"
        onClick={save}
        disabled={saving}
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <hr />

      <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: "rgba(255, 59, 48, 0.12)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            fontSize: 13,
            fontWeight: 600,
            color: "var(--accent-red)",
            cursor: deleting ? "default" : "pointer",
          }}
        >
          {deleting ? "Deleting…" : "Delete Yacht"}
        </button>
      </div>

      {deleteError && (
        <div style={{ marginTop: 10, color: "var(--accent-red)", fontSize: 13 }}>
          {deleteError}
        </div>
      )}

    </div>
  )
}
