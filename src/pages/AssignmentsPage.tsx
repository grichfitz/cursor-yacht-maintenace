import React, { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type TemplateRow = { id: string; name: string }
type GroupRow = { id: string; name: string }
type YachtRow = { id: string; name: string }

type TemplateGroupLinkRow = {
  id: string
  template_id: string
  group_id: string
}

type TemplateYachtLinkRow = {
  id: string
  template_id: string
  yacht_id: string
}

export default function AssignmentsPage() {
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [yachts, setYachts] = useState<YachtRow[]>([])
  const [templateGroupLinks, setTemplateGroupLinks] = useState<TemplateGroupLinkRow[]>([])
  const [templateYachtLinks, setTemplateYachtLinks] = useState<TemplateYachtLinkRow[]>([])

  const [newGroupTemplateId, setNewGroupTemplateId] = useState<string>("")
  const [newGroupId, setNewGroupId] = useState<string>("")

  const [newYachtTemplateId, setNewYachtTemplateId] = useState<string>("")
  const [newYachtId, setNewYachtId] = useState<string>("")

  const templateNameById = useMemo(() => {
    const m = new Map<string, string>()
    templates.forEach((t) => m.set(t.id, t.name))
    return m
  }, [templates])

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>()
    groups.forEach((g) => m.set(g.id, g.name))
    return m
  }, [groups])

  const yachtNameById = useMemo(() => {
    const m = new Map<string, string>()
    yachts.forEach((y) => m.set(y.id, y.name))
    return m
  }, [yachts])

  const load = async () => {
    setLoading(true)
    setError(null)
    setNotice(null)

    const timeoutId = window.setTimeout(() => {
      setLoading(false)
    }, 1500)

    try {
      const [
        { data: t, error: tErr },
        { data: g, error: gErr },
        { data: y, error: yErr },
        { data: tgl, error: tglErr },
        { data: tyl, error: tylErr },
      ] = await Promise.all([
        supabase.from("task_templates").select("id,name").order("name"),
        supabase.from("groups").select("id,name").order("name"),
        supabase.from("yachts").select("id,name").order("name"),
        supabase
          .from("template_group_links")
          .select("id,template_id,group_id")
          .order("created_at", { ascending: false }),
        supabase
          .from("template_yacht_links")
          .select("id,template_id,yacht_id")
          .order("created_at", { ascending: false }),
      ])

      const firstErr = tErr || gErr || yErr || tglErr || tylErr
      if (firstErr) {
        setError(firstErr.message)
        setTemplates([])
        setGroups([])
        setYachts([])
        setTemplateGroupLinks([])
        setTemplateYachtLinks([])
        setLoading(false)
        return
      }

      setTemplates((t as TemplateRow[]) ?? [])
      setGroups((g as GroupRow[]) ?? [])
      setYachts((y as YachtRow[]) ?? [])
      setTemplateGroupLinks((tgl as TemplateGroupLinkRow[]) ?? [])
      setTemplateYachtLinks((tyl as TemplateYachtLinkRow[]) ?? [])
      setLoading(false)
    } finally {
      window.clearTimeout(timeoutId)
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
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const recalc = async () => {
    setWorking(true)
    setError(null)
    setNotice(null)

    const { error: rpcErr } = await supabase.rpc("generate_task_instances")
    setWorking(false)

    if (rpcErr) {
      setError(rpcErr.message)
      return
    }

    setNotice("Task instances recalculated.")
  }

  const addGroupLink = async () => {
    if (!newGroupTemplateId || !newGroupId) return
    if (working) return

    setWorking(true)
    setError(null)
    setNotice(null)

    const { error: insErr } = await supabase.from("template_group_links").insert({
      template_id: newGroupTemplateId,
      group_id: newGroupId,
    })

    if (insErr) {
      setWorking(false)
      setError(insErr.message)
      return
    }

    const { error: rpcErr } = await supabase.rpc("generate_task_instances")
    if (rpcErr) {
      setWorking(false)
      setError(rpcErr.message)
      return
    }

    setNewGroupTemplateId("")
    setNewGroupId("")
    setWorking(false)
    await load()
  }

  const removeGroupLink = async (id: string) => {
    if (working) return
    setWorking(true)
    setError(null)
    setNotice(null)

    const { error: delErr } = await supabase.from("template_group_links").delete().eq("id", id)
    if (delErr) {
      setWorking(false)
      setError(delErr.message)
      return
    }

    const { error: rpcErr } = await supabase.rpc("generate_task_instances")
    if (rpcErr) {
      setWorking(false)
      setError(rpcErr.message)
      return
    }

    setWorking(false)
    await load()
  }

  const addYachtLink = async () => {
    if (!newYachtTemplateId || !newYachtId) return
    if (working) return

    setWorking(true)
    setError(null)
    setNotice(null)

    const { error: insErr } = await supabase.from("template_yacht_links").insert({
      template_id: newYachtTemplateId,
      yacht_id: newYachtId,
    })

    if (insErr) {
      setWorking(false)
      setError(insErr.message)
      return
    }

    const { error: rpcErr } = await supabase.rpc("generate_task_instances")
    if (rpcErr) {
      setWorking(false)
      setError(rpcErr.message)
      return
    }

    setNewYachtTemplateId("")
    setNewYachtId("")
    setWorking(false)
    await load()
  }

  const removeYachtLink = async (id: string) => {
    if (working) return
    setWorking(true)
    setError(null)
    setNotice(null)

    const { error: delErr } = await supabase.from("template_yacht_links").delete().eq("id", id)
    if (delErr) {
      setWorking(false)
      setError(delErr.message)
      return
    }

    const { error: rpcErr } = await supabase.rpc("generate_task_instances")
    if (rpcErr) {
      setWorking(false)
      setError(rpcErr.message)
      return
    }

    setWorking(false)
    await load()
  }

  if (loading) return <div className="screen">Loading…</div>

  return (
    <div className="screen">
      <div className="screen-title">Assignments</div>
      <div className="screen-subtitle">Template links to Groups and Yachts.</div>

      {(error || notice) && (
        <div
          style={{
            color: error ? "var(--accent-red)" : "var(--text-primary)",
            marginBottom: 10,
            fontSize: 13,
          }}
        >
          {error || notice}
        </div>
      )}

      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="secondary" onClick={recalc} disabled={working}>
          {working ? "Working…" : "Recalculate Task Instances"}
        </button>
      </div>

      {/* Table 1: Template ↔ Group */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Template ↔ Group Links</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <select
            value={newGroupTemplateId}
            onChange={(e) => setNewGroupTemplateId(e.target.value)}
            disabled={working}
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)} disabled={working}>
            <option value="">Select group…</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addGroupLink}
            disabled={working || !newGroupTemplateId || !newGroupId}
            style={{ opacity: working || !newGroupTemplateId || !newGroupId ? 0.6 : 1 }}
          >
            Add link
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>Template</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>Group</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)", width: 120 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {templateGroupLinks.length === 0 ? (
              <tr>
                <td style={{ padding: "10px 8px", opacity: 0.75 }} colSpan={3}>
                  No group links.
                </td>
              </tr>
            ) : (
              templateGroupLinks.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {templateNameById.get(l.template_id) ?? l.template_id}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {groupNameById.get(l.group_id) ?? l.group_id}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <button type="button" className="secondary" onClick={() => removeGroupLink(l.id)} disabled={working}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table 2: Template ↔ Yacht */}
      <div className="card">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Template ↔ Yacht Links</div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          <select
            value={newYachtTemplateId}
            onChange={(e) => setNewYachtTemplateId(e.target.value)}
            disabled={working}
          >
            <option value="">Select template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select value={newYachtId} onChange={(e) => setNewYachtId(e.target.value)} disabled={working}>
            <option value="">Select yacht…</option>
            {yachts.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={addYachtLink}
            disabled={working || !newYachtTemplateId || !newYachtId}
            style={{ opacity: working || !newYachtTemplateId || !newYachtId ? 0.6 : 1 }}
          >
            Add link
          </button>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>Template</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>Yacht</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)", width: 120 }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {templateYachtLinks.length === 0 ? (
              <tr>
                <td style={{ padding: "10px 8px", opacity: 0.75 }} colSpan={3}>
                  No yacht links.
                </td>
              </tr>
            ) : (
              templateYachtLinks.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {templateNameById.get(l.template_id) ?? l.template_id}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    {yachtNameById.get(l.yacht_id) ?? l.yacht_id}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <button type="button" className="secondary" onClick={() => removeYachtLink(l.id)} disabled={working}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

