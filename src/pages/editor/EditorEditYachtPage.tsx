import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string }

type YachtRow = {
  id: string
  name: string
  group_id: string | null
  archived_at: string | null
}

export default function EditorEditYachtPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { yachtId } = useParams<{ yachtId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [name, setName] = useState("")
  const [groupId, setGroupId] = useState("")
  const [makeModel, setMakeModel] = useState("")
  const [location, setLocation] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [latestEngineerHours, setLatestEngineerHours] = useState<string>("")

  // YM v2: groups are flat (no parent hierarchy).
  const orderedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups])
  const formatTreeLabel = (g: GroupRow) => g.name

  useEffect(() => {
    if (!session) return
    if (!yachtId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const [{ data: g, error: gErr }, { data: y, error: yErr }] = await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase
          .from("yachts")
          .select("id,name,group_id,archived_at")
          .eq("id", yachtId)
          .maybeSingle(),
      ])

      if (cancelled) return

      if (gErr || yErr) {
        setError(gErr?.message || yErr?.message || "Failed to load yacht.")
        setGroups([])
        setLoading(false)
        return
      }

      const yacht = (y as YachtRow | null) ?? null
      if (!yacht?.id) {
        setError("Yacht not found (or not visible).")
        setGroups((g as GroupRow[]) ?? [])
        setLoading(false)
        return
      }

      setGroups((g as GroupRow[]) ?? [])
      setName(yacht.name ?? "")
      setGroupId(yacht.group_id ?? "")
      setMakeModel("")
      setLocation("")
      setPhotoUrl("")
      setLatestEngineerHours("")
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session, yachtId])

  const save = async () => {
    if (!yachtId) return
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError("Name is required.")
      return
    }
    if (!groupId) {
      setError("Group is required.")
      return
    }

    setSaving(true)
    const { error: upErr } = await supabase
      .from("yachts")
      .update({
        name: trimmed,
        group_id: groupId,
      })
      .eq("id", yachtId)
    setSaving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    navigate("/editor/yachts", { replace: true })
  }

  const del = async () => {
    if (!yachtId) return
    const ok = window.confirm("Delete this yacht?\n\nThis cannot be undone.")
    if (!ok) return

    setDeleting(true)
    setError(null)

    // Block deletion if yacht is referenced by yacht_tasks.
    const { data: yachtTasks, error: ytErr } = await supabase
      .from("yacht_tasks")
      .select("id")
      .eq("yacht_id", yachtId)
      .limit(1)

    if (ytErr) {
      setError(ytErr.message || "Failed to validate yacht references.")
      setDeleting(false)
      return
    }

    const isReferenced = (yachtTasks?.length ?? 0) > 0
    if (isReferenced) {
      setError(
        "This yacht cannot be deleted because it is referenced by yacht_tasks."
      )
      setDeleting(false)
      return
    }

    // Remove non-historical links first.
    const linkDeletes = await Promise.all([
      supabase.from("yacht_group_links").delete().eq("yacht_id", yachtId),
      supabase.from("yacht_user_links").delete().eq("yacht_id", yachtId),
    ])
    const linkError = linkDeletes.find((r) => r.error)?.error
    if (linkError) {
      setError(linkError.message)
      setDeleting(false)
      return
    }

    const { error: delErr } = await supabase.from("yachts").delete().eq("id", yachtId)
    setDeleting(false)
    if (delErr) {
      setError(delErr.message)
      return
    }

    navigate("/editor/yachts", { replace: true })
  }

  if (!yachtId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit yacht</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Group:</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting}>
          <option value="">Select group…</option>
          {orderedGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {formatTreeLabel(g)}
            </option>
          ))}
        </select>

        <label>Make / Model:</label>
        <input value={makeModel} onChange={(e) => setMakeModel(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Location:</label>
        <input value={location} onChange={(e) => setLocation(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Photo URL (optional):</label>
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Latest engineer hours (optional):</label>
        <input value={latestEngineerHours} onChange={(e) => setLatestEngineerHours(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <button type="button" className="cta-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <button
          type="button"
          className="secondary"
          onClick={del}
          disabled={saving || deleting}
          style={{ color: "var(--accent-red)", width: "100%" }}
        >
          {deleting ? "Deleting…" : "Delete yacht"}
        </button>
      </div>
    </div>
  )
}

