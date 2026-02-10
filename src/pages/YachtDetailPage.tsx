import { useNavigate, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import React from "react";

export default function YachtDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [location, setLocation] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
    setSaveError(null)
    setSaving(true)

    const { error } = await supabase
      .from("yachts")
      .update({
        name,
        make_model: makeModel || null,
        location: location || null,
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

    // Block deletion if yacht is referenced by execution/history tables.
    const { data: contexts, error: ctxErr } = await supabase
      .from("task_contexts")
      .select("id")
      .eq("yacht_id", id)
      .limit(1)

    if (ctxErr) {
      setDeleteError(ctxErr.message)
      setDeleting(false)
      return
    }

    const { data: yachtTasks, error: yachtTaskErr } = await supabase
      .from("yacht_tasks")
      .select("id")
      .eq("yacht_id", id)
      .limit(1)

    if (yachtTaskErr) {
      setDeleteError(yachtTaskErr.message)
      setDeleting(false)
      return
    }

    const isReferenced =
      (contexts?.length ?? 0) > 0 || (yachtTasks?.length ?? 0) > 0

    if (isReferenced) {
      setDeleteError(
        "This yacht cannot be deleted because it is referenced by execution/history (task_contexts or yacht_tasks)."
      )
      setDeleting(false)
      return
    }

    // Remove non-historical links first.
    const { error: groupLinkErr } = await supabase
      .from("yacht_group_links")
      .delete()
      .eq("yacht_id", id)

    if (groupLinkErr) {
      setDeleteError(groupLinkErr.message)
      setDeleting(false)
      return
    }

    const { error: userLinkErr } = await supabase
      .from("yacht_user_links")
      .delete()
      .eq("yacht_id", id)

    if (userLinkErr) {
      setDeleteError(userLinkErr.message)
      setDeleting(false)
      return
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

      {/* Assigned Groups — subtle pill like Assigned Categories */}

      <div style={{ marginTop: 8, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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

        <button
          onClick={() => navigate(`/apps/yachts/${id}/tasks`)}
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
          Assigned Tasks
        </button>

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
