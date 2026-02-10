import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import TreeDisplay from "../components/TreeDisplay";
import { useCategoryTree } from "../hooks/useCategoryTree";
import React from "react";

const ROOT_ID = "__root__";

export default function CategoryEditorPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const { nodes } = useCategoryTree();
  const isVirtualCategory = !!categoryId?.startsWith("__")

  const [name, setName] = useState("");
  const [isArchived, setIsArchived] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /* ---------- Load category ---------- */

  useEffect(() => {
    if (!categoryId) return;
    if (categoryId.startsWith("__")) {
      setLoading(false)
      setIsAdmin(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)

      // Determine admin status (for archive/unarchive).
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc("is_admin")
        if (!rpcErr && typeof rpcData === "boolean") {
          if (!cancelled) setIsAdmin(rpcData)
        } else {
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (user) {
            const { data: rolesData, error: rolesError } = await supabase
              .from("user_role_links")
              .select("roles(name)")
              .eq("user_id", user.id)

            if (!rolesError) {
              const admin =
                (rolesData as any[])?.some(
                  (r: any) => r?.roles?.name?.toLowerCase() === "admin"
                ) ?? false
              if (!cancelled) setIsAdmin(admin)
            }
          }
        }
      } catch {
        if (!cancelled) setIsAdmin(false)
      }

      const { data, error: loadErr } = await supabase
        .from("task_categories")
        .select("name,is_archived,parent_id")
        .eq("id", categoryId)
        .single()

      if (cancelled) return

      if (loadErr) {
        setError(loadErr.message)
        setLoading(false)
        return
      }

      if (!data) {
        setError("Category not found.")
        setLoading(false)
        return
      }

      setName((data as any)?.name ?? "")
      setIsArchived(!!(data as any)?.is_archived)
      setSelectedParentId((data as any)?.parent_id ?? ROOT_ID)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
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
    setError(null)

    if (isArchived) {
      setError("This category is archived. Unarchive it before editing.")
      return
    }

    if (!name.trim()) {
      setError("Category name is required.")
      return
    }

    const parentToSave =
      selectedParentId === ROOT_ID || (selectedParentId?.startsWith("__") ?? false)
        ? null
        : selectedParentId;

    setSaving(true)

    const { data: updated, error: updateErr } = await supabase
      .from("task_categories")
      .update({
        name: name.trim(),
        parent_id: parentToSave,
      })
      .eq("id", categoryId)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Save failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    setSaving(false)
    navigate(-1);
  };

  const unarchiveToTopLevel = async () => {
    if (!categoryId) return
    setError(null)

    if (!isAdmin) {
      setError("Only administrators can un-archive categories.")
      return
    }

    setSaving(true)

    const { data: updated, error: updateErr } = await supabase
      .from("task_categories")
      .update({ is_archived: false, parent_id: null })
      .eq("id", categoryId)
      .select("id,name,is_archived,parent_id")
      .maybeSingle()

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Unarchive failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    setIsArchived(false)
    setSelectedParentId(ROOT_ID)
    setName((updated as any)?.name ?? name)
    setSaving(false)
  }

  const archive = async () => {
    if (!categoryId) return
    setError(null)

    if (!isAdmin) {
      setError("Only administrators can archive categories.")
      return
    }

    setSaving(true)

    const { data: updated, error: updateErr } = await supabase
      .from("task_categories")
      .update({ is_archived: true })
      .eq("id", categoryId)
      .select("id,is_archived")
      .maybeSingle()

    if (updateErr) {
      setError(updateErr.message)
      setSaving(false)
      return
    }

    if (!updated?.id) {
      setError("Archive failed (no rows updated). This is usually RLS blocking the update.")
      setSaving(false)
      return
    }

    setIsArchived(true)
    setSaving(false)
  }

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

  if (loading) return <div className="screen">Loading…</div>

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

      {categoryId?.startsWith("__") ? (
        <div
          style={{
            padding: 12,
            background: "rgba(255, 193, 7, 0.1)",
            border: "1px solid rgba(255, 193, 7, 0.3)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Note:</strong> This is a virtual category and cannot be edited.
        </div>
      ) : null}

      <div style={{ fontWeight: 600, marginBottom: 8 }}>
        Category Editor{name ? ` — ${name}` : ""}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            background: "rgba(255, 0, 0, 0.08)",
            border: "1px solid rgba(255, 0, 0, 0.2)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <label>Name:</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={isVirtualCategory || saving || isArchived}
        readOnly={isArchived}
        {...(isArchived
          ? {
              style: {
                marginBottom: 12,
                background: "var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "not-allowed",
              },
            }
          : { style: { marginBottom: 12 } })}
      />

      {/* Archived category: read-only details + single Unarchive */}
      {!isVirtualCategory && isArchived ? (
        <button
          type="button"
          className="cta-button"
          onClick={unarchiveToTopLevel}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
        >
          {saving ? "Unarchiving…" : "Unarchive"}
        </button>
      ) : null}

      {!isVirtualCategory && !isArchived ? (
        <button
          type="button"
          className="cta-button"
          onClick={save}
          disabled={saving}
          style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      ) : null}

      {!isVirtualCategory && !isArchived ? (
        <>
          <hr />

          <div style={{ marginBottom: 8, fontWeight: 500 }}>Move Category</div>

          <div style={{ maxHeight: "40vh", overflowY: "auto", marginBottom: 12 }}>
            <TreeDisplay
              nodes={treeWithRoot}
              renderActions={(node) => {
                const isVirtual = node.id.startsWith("__") && node.id !== ROOT_ID
                const disabled = forbiddenTargets.has(node.id) || isVirtual

                return (
                  <input
                    type="radio"
                    disabled={disabled || saving}
                    checked={selectedParentId === node.id}
                    onChange={() => setSelectedParentId(node.id)}
                    style={{ transform: "scale(1.2)" }}
                  />
                )
              }}
            />
          </div>

          <button
            type="button"
            className="cta-button"
            onClick={save}
            disabled={saving}
            style={{ opacity: saving ? 0.6 : 1, marginBottom: 12 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>

          <hr />

          {isAdmin ? (
            <div style={{ marginBottom: 20 }}>
              <button
                type="button"
                onClick={archive}
                disabled={saving}
                style={{
                  background: "var(--border-subtle)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Archive Category
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
