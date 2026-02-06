import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

  return (
    <div className="app-content">
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

<button
  onClick={() => navigate(`/apps/tasks/${taskId}/categories`)}
  style={{
    background: "var(--border-subtle)",
    border: "none",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    color: "var(--text-primary)",
    fontSize: 13,
  }}
>
  Assigned Categories
</button>



      {/* Category Tree will be added later */}
    </div>
  );
}
