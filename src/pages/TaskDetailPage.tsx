import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import React from "react";

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

    // Default: safe edit. If this task is already used by task_contexts, we create a new version.
    if (!applyGlobally && inUse) {
      // 1) Load current version metadata (lineage/version).
      const { data: current, error: loadErr } = await supabase
        .from("tasks")
        .select("id, lineage_id, version")
        .eq("id", taskId)
        .single()

      if (loadErr || !current) {
        setSaveError(loadErr?.message || "Failed to load current task.")
        setSaving(false)
        return
      }

      const lineageId: string = (current as any)?.lineage_id || taskId
      const nextVersion: number = ((current as any)?.version ?? 1) + 1

      // 2) Create new version (latest).
      const { data: inserted, error: insErr } = await supabase
        .from("tasks")
        .insert({
          name,
          description: description || null,
          default_unit_of_measure_id: unitId,
          default_period_id: periodId,
          lineage_id: lineageId,
          version: nextVersion,
          is_latest: true,
          superseded_at: null,
        })
        .select("id")
        .single()

      if (insErr || !inserted?.id) {
        setSaveError(
          insErr?.message ||
            "Failed to create a new task version. (Did you run migration_task_versioning.sql?)"
        )
        setSaving(false)
        return
      }

      const newTaskId = inserted.id as string

      // 3) Mark all other versions as not latest (keep only the new one latest).
      await supabase
        .from("tasks")
        .update({ is_latest: false, superseded_at: new Date().toISOString() })
        .eq("lineage_id", lineageId)
        .neq("id", newTaskId)

      // 4) Duplicate category mappings so the new version appears where the old template did.
      const { data: catLinks, error: catErr } = await supabase
        .from("task_category_map")
        .select("category_id")
        .eq("task_id", taskId)

      if (!catErr && (catLinks?.length ?? 0) > 0) {
        const rows = (catLinks as any[]).map((l) => ({
          task_id: newTaskId,
          category_id: l.category_id,
        }))
        await supabase.from("task_category_map").upsert(rows)
      }

      // Legacy link table: best-effort keep in sync.
      const { data: legacyLinks } = await supabase
        .from("task_category_links")
        .select("category_id")
        .eq("task_id", taskId)

      if ((legacyLinks?.length ?? 0) > 0) {
        const rows = (legacyLinks as any[]).map((l) => ({
          task_id: newTaskId,
          category_id: l.category_id,
        }))
        await supabase.from("task_category_links").upsert(rows as any)
      }

      setSaveInfo("Saved as a new version. Existing yachts keep the old version.")
      setSaving(false)
      setApplyGlobally(false)
      navigate(`/apps/tasks/${newTaskId}`, { replace: true })
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
      setSaveError(upErr.message)
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
          onClick={() => navigate("/desktop")}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Home
        </button>
      </div>

      <hr />

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

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={applyGlobally}
            disabled={!inUse}
            onChange={(e) => setApplyGlobally(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
          Apply globally
        </label>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            padding: 0,
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
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
