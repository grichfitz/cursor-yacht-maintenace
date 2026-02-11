import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import React from "react";
import { useIsAdmin } from "../hooks/useIsAdmin"

/* ---------- Types ---------- */

type Option = {
  id: string;
  name: string;
};

type TaskRow = {
  id: string;
  name: string;
  description: string | null;
  default_unit_of_measure_id: string | null;
  default_period_id: string | null;
  lineage_id?: string | null;
  version?: number | null;
  is_latest?: boolean | null;
};

/* ---------- Component ---------- */

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin()

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [periodId, setPeriodId] = useState<string | null>(null);

  const [units, setUnits] = useState<Option[]>([]);
  const [periods, setPeriods] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const [applyGlobally, setApplyGlobally] = useState(false);
  const [inUse, setInUse] = useState(false);
  const [saveInfo, setSaveInfo] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  /* ---------- Load task ---------- */

  useEffect(() => {
    if (!taskId) return;

    supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single()
      .then(({ data }) => {
        const row = data as TaskRow | null;
        if (!row) return;

        setName(row.name);
        setDescription(row.description ?? "");
        setUnitId(row.default_unit_of_measure_id);
        setPeriodId(row.default_period_id);
      });
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return

    const checkInUse = async () => {
      const { data: contexts, error: ctxErr } = await supabase
        .from("task_contexts")
        .select("id")
        .eq("task_id", taskId)
        .limit(1)

      if (ctxErr) return
      setInUse((contexts?.length ?? 0) > 0)
    }

    checkInUse()
  }, [taskId])

  /* ---------- Load dropdown data ---------- */

  useEffect(() => {
    supabase.from("units_of_measure").select("id,name").then(({ data }) => {
      setUnits(data || []);
    });

    supabase.from("periods").select("id,name").then(({ data }) => {
      setPeriods(data || []);
    });
  }, []);

  /* ---------- Save ---------- */

  const handleSave = async () => {
    if (!taskId) return;

    setSaveInfo(null)
    setSaveError(null)
    setSaving(true);

    const formatRlsError = (rawMessage?: string) => {
      return (
        rawMessage ||
        "Permission denied by Row Level Security (RLS)."
      )
    }

    // IMPORTANT (Stabilisation + RLS):
    // Creating new task versions requires INSERT into `public.tasks`, which is intentionally blocked
    // under current RLS (see smoke tests). Don't attempt it from the client.
    if (!applyGlobally && inUse) {
      setSaveError(
        "This task has already been assigned to at least one yacht.\n\nTo avoid changing existing yachts, the app would normally create a NEW version of this task when you save — but database security (RLS) blocks creating new tasks from the app.\n\nIf you want to save right now, turn on “Apply globally” (this edits the existing task for everyone). Otherwise, this needs an admin/server tool later."
      )
      setSaving(false)
      return
    }

    // Global edit (or not in use): update this task version in-place.
    const { error: upErr } = await supabase
      .from("tasks")
      .update({
        name,
        description,
        default_unit_of_measure_id: unitId,
        default_period_id: periodId,
      })
      .eq("id", taskId);

    if (upErr) {
      const msg = upErr?.message
      const looksLikeRls =
        (upErr as any)?.status === 403 ||
        (typeof msg === "string" && msg.toLowerCase().includes("row level security"))

      setSaveError(
        looksLikeRls
          ? `Save blocked by RLS. ${formatRlsError(msg)}`
          : upErr.message
      )
      setSaving(false)
      return
    }

    setSaving(false);
    setSaveInfo("Saved.")
  };

  /* ---------- Delete (safe) ---------- */

  const handleDelete = async () => {
    if (!taskId) return;

    setDeleteError(null);

    const ok = window.confirm(
      "Delete this task template?\n\nThis cannot be undone."
    );
    if (!ok) return;

    setDeleting(true);

    // Schema source of truth: tasks can be referenced by task_contexts and yacht_tasks.
    const { data: contexts, error: ctxErr } = await supabase
      .from("task_contexts")
      .select("id")
      .eq("task_id", taskId)
      .limit(1);

    if (ctxErr) {
      setDeleteError(ctxErr.message);
      setDeleting(false);
      return;
    }

    const { data: yachtTasks, error: yachtTaskErr } = await supabase
      .from("yacht_tasks")
      .select("id")
      .eq("task_id", taskId)
      .limit(1);

    if (yachtTaskErr) {
      setDeleteError(yachtTaskErr.message);
      setDeleting(false);
      return;
    }

    const isReferenced =
      (contexts?.length ?? 0) > 0 || (yachtTasks?.length ?? 0) > 0;

    if (isReferenced) {
      setDeleteError(
        "This task cannot be deleted because it is already referenced by yacht/task history (task_contexts or yacht_tasks)."
      );
      setDeleting(false);
      return;
    }

    // Remove category mappings first (avoid orphan links).
    const { error: mapErr } = await supabase
      .from("task_category_map")
      .delete()
      .eq("task_id", taskId);

    if (mapErr) {
      setDeleteError(mapErr.message);
      setDeleting(false);
      return;
    }

    // Legacy table (present in schema): if it exists/used, clear it too.
    await supabase.from("task_category_links").delete().eq("task_id", taskId);

    const { error: delErr } = await supabase.from("tasks").delete().eq("id", taskId);

    if (delErr) {
      setDeleteError(delErr.message);
      setDeleting(false);
      return;
    }

    setDeleting(false);
    navigate("/apps/tasks", { replace: true });
  };

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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Task Editor</div>
      {!isAdmin && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
          Note: Task template editing/versioning may be restricted by RLS. If you see a 403 error, an admin/server-side path is required.
        </div>
      )}

      {/* Name */}
      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      {/* Description */}
      <label>Description / Notes:</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        style={{ marginBottom: 12 }}
      />

      {/* Measurement */}
      <label>Measurement:</label>
      <select
        value={unitId ?? ""}
        onChange={(e) => setUnitId(e.target.value || null)}
        style={{ marginBottom: 12 }}
      >
        <option value="">—</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>

      {/* Schedule */}
      <label>Schedule Period:</label>
      <select
        value={periodId ?? ""}
        onChange={(e) => setPeriodId(e.target.value || null)}
        style={{ marginBottom: 12 }}
      >
        <option value="">—</option>
        {periods.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {saveError && (
        <div style={{ color: "var(--accent-red)", marginBottom: 10, fontSize: 13 }}>
          {saveError}
        </div>
      )}

      {saveInfo && (
        <div style={{ color: "var(--text-secondary)", marginBottom: 10, fontSize: 13 }}>
          {saveInfo}
        </div>
      )}

      <button
        type="button"
        className="cta-button"
        onClick={handleSave}
        disabled={saving}
        style={{ opacity: saving ? 0.6 : 1 }}
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <div style={{ height: 10 }} />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={applyGlobally}
          disabled={!inUse}
          onChange={(e) => setApplyGlobally(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        Apply globally
      </label>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -6, marginBottom: 12 }}>
        On = edit the existing task everywhere. Off = would create a new version (blocked in-app by database security).
      </div>

      <hr />

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          onClick={() => navigate(`/apps/tasks/${taskId}/categories`)}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Assigned Categories
        </button>

        <button
          onClick={() => navigate(`/apps/tasks/${taskId}/yachts`)}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Assigned Yachts
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            background: "rgba(255, 59, 48, 0.12)",
            border: "none",
            borderRadius: 12,
            padding: "4px 10px",
            cursor: deleting ? "default" : "pointer",
            color: "var(--accent-red)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {deleting ? "Deleting…" : "Delete Task"}
        </button>
      </div>

      {deleteError && (
        <div style={{ marginTop: 10, color: "var(--accent-red)", fontSize: 13 }}>
          {deleteError}
        </div>
      )}



      {/* Category Tree will be added later */}
    </div>
  );
}
