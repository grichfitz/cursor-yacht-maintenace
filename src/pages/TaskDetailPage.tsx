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

    setSaving(true);

    await supabase
      .from("tasks")
      .update({
        name,
        description,
        default_unit_of_measure_id: unitId,
        default_period_id: periodId,
      })
      .eq("id", taskId);

    setSaving(false);
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

      {/* Save */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
