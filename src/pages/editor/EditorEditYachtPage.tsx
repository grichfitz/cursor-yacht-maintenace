import React, { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../../lib/supabase"
import { useSession } from "../../auth/SessionProvider"
import EditorNav from "./EditorNav"
import { isMissingRelationError, isRelationKnownMissing, rememberMissingRelation } from "../../utils/supabaseRelations"

type GroupRow = { id: string; name: string }

type YachtRow = {
  id: string
  name: string
  group_id: string | null
  archived_at: string | null
}

type TaskRow = {
  id: string
  title: string
  status: string
  due_date: string | null
}

export default function EditorEditYachtPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { yachtId } = useParams<{ yachtId: string }>()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [groups, setGroups] = useState<GroupRow[]>([])

  const [name, setName] = useState("")
  const [groupId, setGroupId] = useState("")
  const [archivedAt, setArchivedAt] = useState<string | null>(null)
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [tasksError, setTasksError] = useState<string | null>(null)

  const orderedGroups = useMemo(() => [...groups].sort((a, b) => a.name.localeCompare(b.name)), [groups])

  useEffect(() => {
    if (!session) return
    if (!yachtId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      const [{ data: g, error: gErr }, { data: y, error: yErr }, { data: t, error: tErr }] = await Promise.all([
        supabase.from("groups").select("id,name").order("name"),
        supabase
          .from("yachts")
          .select("id,name,group_id,archived_at")
          .eq("id", yachtId)
          .maybeSingle(),
        supabase
          .from("tasks")
          .select("id,title,status,due_date")
          .eq("yacht_id", yachtId)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(200),
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
      setArchivedAt(yacht.archived_at ?? null)
      setTasks((t as TaskRow[]) ?? [])
      setTasksError(tErr ? tErr.message : null)
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

    // Block deletion if yacht is referenced by tasks.
    let yachtTasks: unknown[] | null = null
    let ytErr: { message?: string } | null = null

    if (!isRelationKnownMissing("tasks")) {
      const r = await supabase.from("tasks").select("id").eq("yacht_id", yachtId).limit(1)
      yachtTasks = (r.data as unknown[]) ?? null
      ytErr = (r.error as any) ?? null
      if (ytErr && isMissingRelationError(ytErr)) {
        rememberMissingRelation("tasks")
        yachtTasks = []
        ytErr = null
      }
    } else {
      yachtTasks = []
    }

    if (ytErr) {
      setError(ytErr.message || "Failed to validate yacht references.")
      setDeleting(false)
      return
    }

    const isReferenced = (yachtTasks?.length ?? 0) > 0
    if (isReferenced) {
      setError(
        "This yacht cannot be deleted because it is referenced by tasks."
      )
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

  const toggleArchive = async () => {
    if (!yachtId) return
    setError(null)
    setNotice(null)

    const nextIsArchived = !archivedAt
    const ok = window.confirm(nextIsArchived ? "Archive this yacht?\n\nIt will be hidden from lists." : "Unarchive this yacht?\n\nIt will reappear in lists.")
    if (!ok) return

    setArchiving(true)
    const nextArchivedAt = nextIsArchived ? new Date().toISOString() : null

    const { error: upErr } = await supabase
      .from("yachts")
      .update({ archived_at: nextArchivedAt })
      .eq("id", yachtId)

    setArchiving(false)

    if (upErr) {
      setError(upErr.message)
      return
    }

    setArchivedAt(nextArchivedAt)
    setNotice(nextIsArchived ? "Yacht archived." : "Yacht unarchived.")
  }

  if (!yachtId) return null
  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <EditorNav />
      <div className="screen-title">Edit yacht</div>
      <div className="screen-subtitle">Admin-only.</div>

      {error ? <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{error}</div> : null}
      {notice && !error ? (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>{notice}</div>
      ) : null}

      <div className="card">
        <label>Name:</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting} />

        <label>Group:</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} style={{ marginBottom: 12 }} disabled={saving || deleting}>
          <option value="">Select group…</option>
          {orderedGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <button type="button" className="cta-button" onClick={save} disabled={saving || deleting}>
          {saving ? "Saving…" : "Save"}
        </button>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 8 }}>Tasks</div>
        {tasksError ? (
          <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{tasksError}</div>
        ) : null}

        <div className="card card-list" style={{ margin: 0 }}>
          <div className="list-row" style={{ justifyContent: "space-between" }}>
            <div style={{ fontWeight: 700 }}>Tasks</div>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate(`/editor/tasks/new?yachtId=${encodeURIComponent(yachtId)}`)}
              disabled={saving || deleting}
            >
              New task
            </button>
          </div>

          {tasks.length === 0 ? (
            <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>No tasks.</div>
          ) : (
            tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className="list-button"
                onClick={() => navigate(`/editor/tasks/${t.id}`)}
              >
                <div className="list-button-main">
                  <div className="list-button-title">{t.title}</div>
                  <div className="list-button-subtitle">
                    {t.due_date ? `Due ${new Date(t.due_date).toLocaleDateString()}` : "No due date"} · {t.status}
                  </div>
                </div>
                <div className="list-button-chevron">›</div>
              </button>
            ))
          )}
        </div>

        <hr />

        <div style={{ fontWeight: 800, marginBottom: 6 }}>Archive</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
          Archived yachts are hidden from lists.
        </div>
        {archivedAt ? (
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
            Archived {new Date(archivedAt).toLocaleDateString()}
          </div>
        ) : null}

        <button
          type="button"
          className="secondary"
          onClick={toggleArchive}
          disabled={saving || deleting || archiving}
          style={{
            width: "100%",
            color: archivedAt ? "var(--accent-blue)" : "var(--accent-orange)",
            background: archivedAt ? "rgba(10, 132, 255, 0.10)" : "rgba(255, 159, 10, 0.12)",
          }}
        >
          {archiving ? (archivedAt ? "Unarchiving…" : "Archiving…") : archivedAt ? "Unarchive yacht" : "Archive yacht"}
        </button>

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

