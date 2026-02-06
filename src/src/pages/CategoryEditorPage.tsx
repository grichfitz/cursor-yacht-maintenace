import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import TreeDisplay from "../components/TreeDisplay";
import { useCategoryTree } from "../hooks/useCategoryTree";

const ROOT_ID = "__root__";

export default function CategoryEditorPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { nodes } = useCategoryTree();

  const [name, setName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  /* ---------- Load category ---------- */

  useEffect(() => {
    if (!categoryId) return;

    supabase
      .from("task_categories")
      .select("name,is_archived,parent_id")
      .eq("id", categoryId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name);
        setIsArchived(!!data.is_archived);
        setSelectedParentId(data.parent_id ?? ROOT_ID);
      });
  }, [categoryId]);

  /* ---------- Circular move prevention ---------- */

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    nodes.forEach((n) => {
      if (!n.parentId) return;
      if (!map[n.parentId]) map[n.parentId] = [];
      map[n.parentId].push(n.id);
    });
    return map;
  }, [nodes]);

  const getDescendants = (id: string): string[] => {
    const kids = childrenMap[id] || [];
    return kids.flatMap((k) => [k, ...getDescendants(k)]);
  };

  const forbiddenTargets = useMemo(() => {
    if (!categoryId) return new Set<string>();
    return new Set([categoryId, ...getDescendants(categoryId)]);
  }, [categoryId, childrenMap]);

  /* ---------- Save ---------- */

  const save = async () => {
    if (!categoryId) return;

    const parentToSave =
      selectedParentId === ROOT_ID ? null : selectedParentId;

    await supabase
      .from("task_categories")
      .update({
        name,
        parent_id: parentToSave,
      })
      .eq("id", categoryId);

    navigate(-1);
  };

  const toggleArchive = async () => {
    if (!categoryId) return;

    await supabase
      .from("task_categories")
      .update({ is_archived: !isArchived })
      .eq("id", categoryId);

    navigate(-1);
  };

  /* ---------- Virtual Top Level ---------- */

  const treeWithRoot = useMemo(() => {
    return [
      ...nodes,
      {
        id: ROOT_ID,
        label: "Top Level",
        parentId: null,
      },
    ];
  }, [nodes]);

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

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Category Editor</div>

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 12 }}
      />

      <hr />

      <div style={{ marginBottom: 8, fontWeight: 500 }}>Move Category</div>

      <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 12 }}>
        <TreeDisplay
          nodes={treeWithRoot}
          renderActions={(node) => {
            const disabled = forbiddenTargets.has(node.id);

            return (
              <input
                type="radio"
                disabled={disabled}
                checked={selectedParentId === node.id}
                onChange={() => setSelectedParentId(node.id)}
                style={{ transform: "scale(1.2)" }}
              />
            );
          }}
        />
      </div>

      {/* Save Button */}

      <div style={{ marginTop: 20 }}>
        <button
          onClick={save}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 8,
            border: "1px solid var(--border-subtle)",
            background: "transparent",
            fontWeight: 600,
            cursor: "pointer",
            color: "var(--text-primary)",
          }}
        >
          Save
        </button>

      <hr />

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={toggleArchive}
          style={{
            background: "var(--border-subtle)",
            border: "none",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {isArchived ? "Un-archive Category" : "Archive Category"}
        </button>
      </div>

      </div>
    </div>
  );
}
