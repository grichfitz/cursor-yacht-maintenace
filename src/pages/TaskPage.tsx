import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useFocusReload } from "../hooks/useFocusReload"
import { useSession } from "../auth/SessionProvider"
import { loadAccessibleYachtIds } from "../utils/taskAccess"
import { useMyRole } from "../hooks/useMyRole"

type TaskRow = {
  id: string
  title: string
  status: string
  yacht_id: string
  category_id: string | null
  due_date: string | null
  template_id: string | null
  description: string | null
  completed_at: string | null
  completed_by: string | null
}

type YachtRow = { id: string; name: string }

type TestResult = "" | "pass" | "fail" | "n/a"

const TASK_PHOTOS_BUCKET =
  (import.meta.env.VITE_TASK_PHOTOS_BUCKET as string | undefined) || "task-photos"

type CompletionSummary = {
  taskTitle: string
  yachtName: string
  testResult: TestResult
  comments: string
  photoAttached: boolean
}

function formatCompletionAppend(params: {
  atIso: string
  byUserId: string
  testResult: TestResult
  comments: string
  photoPath?: string | null
}) {
  const { atIso, byUserId, testResult, comments, photoPath } = params
  const lines: string[] = []
  lines.push("---")
  lines.push(`Completion (ready for review)`)
  lines.push(`Completed at: ${atIso}`)
  lines.push(`Completed by: ${byUserId}`)
  if (testResult) lines.push(`Test result: ${testResult}`)
  if (comments.trim()) lines.push(`Comments: ${comments.trim()}`)
  if (photoPath) lines.push(`Photo: ${photoPath}`)
  return `\n\n${lines.join("\n")}\n`
}

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { session } = useSession()
  const { role, loading: roleLoading } = useMyRole()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [task, setTask] = useState<TaskRow | null>(null)
  const [yacht, setYacht] = useState<YachtRow | null>(null)

  const [testResult, setTestResult] = useState<TestResult>("")
  const [comments, setComments] = useState("")
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const canEditTaskMeta = role === "admin" || role === "manager"
  const [metaTitle, setMetaTitle] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [metaSaved, setMetaSaved] = useState<string | null>(null)

  const [showWellDone, setShowWellDone] = useState(false)
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null)

  const photoPreviewUrl = useMemo(() => {
    if (!photoFile) return ""
    return URL.createObjectURL(photoFile)
  }, [photoFile])

  useEffect(() => {
    if (!photoPreviewUrl) return
    return () => URL.revokeObjectURL(photoPreviewUrl)
  }, [photoPreviewUrl])

  const load = useCallback(async () => {
    if (!taskId) return
    setLoading(true)
    setError(null)

    const timeoutId = window.setTimeout(() => setLoading(false), 1500)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const yachtIds = await loadAccessibleYachtIds(user.id)
      if (yachtIds.length === 0) {
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const { data: t, error: tErr } = await supabase
        .from("tasks")
        .select("id,title,status,yacht_id,category_id,due_date,template_id,description,completed_at,completed_by")
        .eq("id", taskId)
        .in("yacht_id", yachtIds)
        .maybeSingle()

      if (tErr) {
        setError(tErr.message)
        setTask(null)
        setYacht(null)
        setLoading(false)
        return
      }

      const row = (t as TaskRow | null) ?? null
      setTask(row)
      setSaveError(null)
      setSaved(false)
      setMetaError(null)
      setMetaSaved(null)
      setMetaTitle(row?.title ?? "")
      setMetaDescription(row?.description ?? "")
      setShowWellDone(false)
      setCompletionSummary(null)

      if (!row?.yacht_id) {
        setYacht(null)
        setLoading(false)
        return
      }

      const { data: y, error: yErr } = await supabase
        .from("yachts")
        .select("id,name")
        .eq("id", row.yacht_id)
        .maybeSingle()

      if (!yErr) setYacht((y as YachtRow) ?? null)
      else setYacht(null)

      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }, [taskId])

  const markReadyForReview = async () => {
    if (!session?.user?.id) return
    if (!taskId) return
    if (!task) return

    setSaving(true)
    setSaveError(null)
    setSaved(false)

    try {
      const summary: CompletionSummary = {
        taskTitle: (canEditTaskMeta ? metaTitle : task.title) || task.title || "Task",
        yachtName: yacht?.name || "",
        testResult,
        comments,
        photoAttached: !!photoFile,
      }

      let uploadedPath: string | null = null

      if (photoFile) {
        const ext = (photoFile.name.split(".").pop() || "jpg").toLowerCase()
        const safeExt = ext && ext.length <= 6 ? ext : "jpg"
        const namePart =
          (typeof crypto !== "undefined" && "randomUUID" in crypto && typeof (crypto as any).randomUUID === "function"
            ? (crypto as any).randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`) as string
        uploadedPath = `tasks/${taskId}/${namePart}.${safeExt}`

        const { error: upErr } = await supabase.storage
          .from(TASK_PHOTOS_BUCKET)
          .upload(uploadedPath, photoFile, {
            contentType: photoFile.type || "image/jpeg",
            upsert: false,
          })

        if (upErr) throw upErr
      }

      const atIso = new Date().toISOString()
      const append = formatCompletionAppend({
        atIso,
        byUserId: session.user.id,
        testResult,
        comments,
        photoPath: uploadedPath,
      })

      const nextDescription = `${task.description ?? ""}${append}`.trim()

      const { error: upErr } = await supabase
        .from("tasks")
        .update({
          status: "completed",
          completed_at: atIso,
          completed_by: session.user.id,
          description: nextDescription || null,
        })
        .eq("id", taskId)

      if (upErr) throw upErr

      setCompletionSummary(summary)
      setShowWellDone(true)

      // reset form state for next task
      setSaved(true)
      setPhotoFile(null)
      setComments("")
      setTestResult("")
    } catch (e: any) {
      setSaveError(e?.message || "Failed to complete task.")
    } finally {
      setSaving(false)
    }
  }

  const saveTaskMeta = async () => {
    if (!session?.user?.id) return
    if (!taskId) return
    if (!task) return
    if (!canEditTaskMeta) return

    setMetaSaving(true)
    setMetaError(null)
    setMetaSaved(null)
    try {
      const nextTitle = metaTitle.trim()
      const nextDescription = metaDescription.trim()
      if (!nextTitle) {
        setMetaSaving(false)
        setMetaError("Title is required.")
        return
      }

      const { error: upErr } = await supabase
        .from("tasks")
        .update({
          title: nextTitle,
          description: nextDescription ? nextDescription : null,
        })
        .eq("id", taskId)

      if (upErr) throw upErr
      setMetaSaved("Saved.")
      await load()
    } catch (e: any) {
      setMetaError(e?.message || "Failed to save task.")
    } finally {
      setMetaSaving(false)
    }
  }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const run = async () => {
      if (cancelled) return
      await load()
    }

    run()
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") run()
    })

    return () => {
      cancelled = true
      sub.data.subscription.unsubscribe()
    }
  }, [session, load])

  useFocusReload(() => {
    void load()
  }, true)

  if (!taskId) return null
  if (loading || roleLoading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, marginTop: -6 }}>
        <button type="button" onClick={() => navigate(-1)} className="primary-button" disabled={showWellDone}>
          ← Back
        </button>
      </div>

      <hr />

      {error && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {error}
        </div>
      )}

      {showWellDone && completionSummary ? (
        <div className="card">
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Well done</div>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 12 }}>Task is ready for review.</div>

          <div style={{ border: "1px solid var(--border-subtle)", borderRadius: 14, padding: 12, marginBottom: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Summary</div>

            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <div style={{ fontWeight: 700 }}>{completionSummary.taskTitle}</div>
              {completionSummary.yachtName ? (
                <div style={{ opacity: 0.8 }}>{completionSummary.yachtName}</div>
              ) : null}
            </div>

            <div style={{ fontSize: 13, opacity: 0.9, display: "grid", gap: 6 }}>
              <div>
                <strong>Result:</strong> {completionSummary.testResult || "—"}
              </div>
              <div>
                <strong>Comments:</strong>{" "}
                {completionSummary.comments.trim() ? completionSummary.comments.trim() : "—"}
              </div>
              <div>
                <strong>Photo:</strong> {completionSummary.photoAttached ? "Attached" : "—"}
              </div>
            </div>
          </div>

          <button type="button" className="cta-button" onClick={() => navigate("/tasks", { replace: true })}>
            Continue
          </button>
        </div>
      ) : !task ? (
        <div style={{ opacity: 0.75, fontSize: 13 }}>Task not found (or not visible).</div>
      ) : (
        <>
          {canEditTaskMeta ? (
            <div className="card">
              <div style={{ fontWeight: 800, marginBottom: 10 }}>Task</div>

              {metaError ? (
                <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{metaError}</div>
              ) : null}
              {metaSaved && !metaError ? (
                <div style={{ color: "rgba(0, 180, 60, 1)", marginBottom: 10, fontSize: 13 }}>{metaSaved}</div>
              ) : null}

              <label>Title:</label>
              <input
                value={metaTitle}
                onChange={(e) => {
                  setMetaTitle(e.target.value)
                  setMetaSaved(null)
                }}
                style={{ marginBottom: 12 }}
                disabled={metaSaving || saving}
              />

              <label>Description:</label>
              <textarea
                value={metaDescription}
                onChange={(e) => {
                  setMetaDescription(e.target.value)
                  setMetaSaved(null)
                }}
                rows={3}
                style={{ marginBottom: 12 }}
                disabled={metaSaving || saving}
                placeholder="Description…"
              />

              <button type="button" className="secondary" onClick={saveTaskMeta} disabled={metaSaving || saving} style={{ width: "100%" }}>
                {metaSaving ? "Saving…" : "Save"}
              </button>
            </div>
          ) : (
            <>
              <div className="screen-title" style={{ marginBottom: 8 }}>
                {task.title}
              </div>

              <div className="card">
                <div style={{ fontWeight: 700, marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 13, opacity: 0.9, whiteSpace: "pre-wrap" }}>
                  {task.description?.trim() ? task.description : "—"}
                </div>
              </div>
            </>
          )}

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Yacht</div>
            {yacht ? (
              <button
                type="button"
                className="list-button"
                onClick={() => navigate(`/yachts/${yacht.id}`)}
                style={{ padding: "8px 10px", borderRadius: 12 }}
              >
                <div className="list-button-main">
                  <div className="list-button-title" style={{ fontSize: 13, fontWeight: 700 }}>
                    {yacht.name}
                  </div>
                </div>
                <div className="list-button-chevron" style={{ fontSize: 18, lineHeight: 1 }}>
                  ›
                </div>
              </button>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.75 }}>{task.yacht_id}</div>
            )}
          </div>

          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{task.status}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Due</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {task.due_date ? new Date(task.due_date).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Completion</div>

            {saveError ? (
              <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>{saveError}</div>
            ) : null}
            {saved && !saveError ? (
              <div style={{ color: "rgba(0, 180, 60, 1)", marginBottom: 10, fontSize: 13 }}>Saved.</div>
            ) : null}

            <label>Result of test:</label>
            <select
              value={testResult}
              onChange={(e) => setTestResult(e.target.value as TestResult)}
              style={{ marginBottom: 12 }}
              disabled={saving}
            >
              <option value="">—</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="n/a">N/A</option>
            </select>

            <label>Comments:</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              style={{ marginBottom: 12 }}
              disabled={saving}
              placeholder="What did you do? What changed? Anything to watch?"
            />

            <label>Take photo:</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={saving}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setPhotoFile(f)
              }}
              style={{ marginBottom: 12 }}
            />

            {photoPreviewUrl ? (
              <div style={{ marginBottom: 12 }}>
                <img
                  src={photoPreviewUrl}
                  alt=""
                  style={{
                    width: "100%",
                    maxHeight: 240,
                    objectFit: "cover",
                    borderRadius: 14,
                    border: "1px solid var(--border-subtle)",
                    marginBottom: 8,
                  }}
                />
                <button type="button" className="secondary" onClick={() => setPhotoFile(null)} disabled={saving} style={{ width: "100%" }}>
                  Remove photo
                </button>
              </div>
            ) : null}

            <button type="button" className="cta-button" onClick={markReadyForReview} disabled={saving}>
              {saving ? "Saving…" : "Ready for review"}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

