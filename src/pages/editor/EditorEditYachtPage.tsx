import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"

type GroupRow = { id: string; name: string; parent_group_id: string | null }

type YachtRow = {
  id: string
  name: string
  group_id: string | null
  make_model: string | null
  location: string | null
  photo_url: string | null
  latest_engineer_hours: number | null
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

  const groupById = useMemo(() => {
    const m = new Map<string, GroupRow>()
    groups.forEach((g) => m.set(g.id, g))
    return m
  }, [groups])

  const childrenMap = useMemo(() => {
    const m = new Map<string | null, GroupRow[]>()
    for (const g of groups) {
      const key = g.parent_group_id && groupById.has(g.parent_group_id) ? g.parent_group_id : null
      const arr = m.get(key) ?? []
      arr.push(g)
      m.set(key, arr)
    }
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      m.set(k, arr)
    }
    return m
  }, [groups, groupById])

  const orderedGroups = useMemo(() => {
    const out: Array<{ g: GroupRow; depth: number }> = []
    const visited = new Set<string>()

    const walk = (parentId: string | null, depth: number) => {
      const kids = childrenMap.get(parentId) ?? []
      for (const g of kids) {
        if (visited.has(g.id)) continue
        visited.add(g.id)
        out.push({ g, depth })
        walk(g.id, depth + 1)
      }
    }

    walk(null, 0)

    for (const g of groups) {
      if (!visited.has(g.id)) out.push({ g, depth: 0 })
    }

    return out
  }, [childrenMap, groups])

  const formatTreeLabel = (g: GroupRow) => {
    const parts: string[] = [g.name]
    let cur = g
    let guard = 0
    while (cur.parent_group_id && groupById.has(cur.parent_group_id) && guard < 10) {
      const p = groupById.get(cur.parent_group_id)!
      parts.unshift(p.name)
      cur = p
      guard++
    }
    return parts.join(" › ")
  }

  useEffect(() => {
    if (!session) return
    if (!yachtId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const [{ data: g, error: gErr }, { data: y, error: yErr }] = await Promise.all([
        supabase.from("groups").select("id,name,parent_group_id").order("name"),
        supabase
          .from("yachts")
          .select("id,name,group_id,make_model,location,photo_url,latest_engineer_hours")
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
      setMakeModel(yacht.make_model ?? "")
      setLocation(yacht.location ?? "")
      setPhotoUrl(yacht.photo_url ?? "")
      setLatestEngineerHours(
        typeof yacht.latest_engineer_hours === "number" ? String(yacht.latest_engineer_hours) : ""
      )
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

    const eh = latestEngineerHours.trim()
    const hours = eh === "" ? null : Number(eh)
    if (hours !== null && (!Number.isFinite(hours) || hours < 0)) {
      setError("Engineer hours must be a non-negative number (or blank).")
      return
    }

    setSaving(true)
    const { error: upErr } = await supabase
      .from("yachts")
      .update({
        name: trimmed,
        group_id: groupId,
        make_model: makeModel.trim() ? makeModel.trim() : null,
        location: location.trim() ? location.trim() : null,
        photo_url: photoUrl.trim() ? photoUrl.trim() : null,
        latest_engineer_hours: hours,
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

    // Block deletion if yacht is referenced by execution/history tables.
    const [{ data: contexts, error: ctxErr }, { data: yachtTasks, error: ytErr }] = await Promise.all([
      supabase.from("task_contexts").select("id").eq("yacht_id", yachtId).limit(1),
      supabase.from("yacht_tasks").select("id").eq("yacht_id", yachtId).limit(1),
    ])

    if (ctxErr || ytErr) {
      setError(ctxErr?.message || ytErr?.message || "Failed to validate yacht references.")
      setDeleting(false)
      return
    }

    const isReferenced = (contexts?.length ?? 0) > 0 || (yachtTasks?.length ?? 0) > 0
    if (isReferenced) {
      setError(
        "This yacht cannot be deleted because it is referenced by execution/history (task_contexts or yacht_tasks)."
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
          {orderedGroups.map(({ g }) => (
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

