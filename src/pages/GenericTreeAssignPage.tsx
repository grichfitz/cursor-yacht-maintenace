import React from "react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import type { TreeNode } from "../components/TreeDisplay"
import { Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"
import { useSession } from "../auth/SessionProvider"

type Props = {
  targetId: string
  nodes: TreeNode[]
  mapTable: string
  mapTargetField: string
  mapNodeField: string
  editBasePath?: string
}

export default function GenericTreeAssignPage({
  targetId,
  nodes,
  mapTable,
  mapTargetField,
  mapNodeField,
  editBasePath
}: Props) {
  const navigate = useNavigate()
  const { session } = useSession()
  const [checked, setChecked] = useState<string[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)

  // Determine if we should use radio buttons (for one-to-one relationships like yacht_group_links)
  const useRadioButtons = mapTable === "yacht_group_links" && mapTargetField === "yacht_id"
  
  // Check if this is user-group assignment (admin/service only per RLS_DESIGN.md)
  const isUserGroupAssignment = mapTable === "group_members"

  // Check if current user is admin
  useEffect(() => {
    if (!session) return
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("user_role_links")
        .select("roles(name)")
        .eq("user_id", user.id)

      if (error) {
        console.error("Error checking admin status:", error)
        return
      }

      const hasAdminRole = (data as any[])?.some(
        (r: any) => r?.roles?.name?.toLowerCase() === "admin"
      ) ?? false

      setIsAdmin(hasAdminRole)
    }

    checkAdmin()
  }, [session])

  useEffect(() => {
    if (!session) return
    supabase
      .from(mapTable)
      .select(mapNodeField)
      .eq(mapTargetField, targetId)
      .then(({ data, error }) => {
        if (error) {
          console.error("Error loading assignments:", error)
          return
        }
        setChecked((data as any[])?.map(r => r[mapNodeField]) ?? [])
      })
  }, [targetId, mapTable, mapTargetField, mapNodeField, session])

  // Canonical access model is flat; no recursive/descendant assignment logic.

  const toggle = async (id: string) => {
    // Prevent multiple rapid clicks
    if (loading === id) {
      return
    }
    
    // Block user-group assignment for non-admins (admin/service only per RLS_DESIGN.md)
    if (isUserGroupAssignment && !isAdmin) {
      alert("User-group assignment is restricted. Only administrators can modify user-group memberships.")
      return
    }
    
    const shouldCheck = !checked.includes(id)
    const autoAssignChildrenOnCheck = false
    const idsToCheck = [id]

    setLoading(id)
    
    if (useRadioButtons) {
      // Radio button mode: selecting one deselects others (only one can be selected)
      if (shouldCheck) {
        // Selecting a new group - replace current selection
        setChecked([id])
      } else {
        // Unchecking current selection - clear assignment (unassign yacht)
        setChecked([])
      }
    } else {
      // Checkbox mode
      setChecked((prev) => {
        if (!shouldCheck) return prev.filter((x) => x !== id)
        return [...prev, id]
      })
    }

    if (shouldCheck) {
      // Special handling for yacht_group_links: one yacht = one group
      if (useRadioButtons) {
        // For yacht_group_links: DELETE then INSERT (handles unique constraint on yacht_id)
        const { error: deleteError } = await supabase
          .from(mapTable)
          .delete()
          .eq(mapTargetField, targetId)
        
        if (deleteError && deleteError.code !== "PGRST116") {
          console.warn("Delete warning (may be OK if no row exists):", deleteError)
        }
        
        // Small delay to ensure DELETE completes
        await new Promise(resolve => setTimeout(resolve, 150))
        
        // Insert new assignment with retry logic
        let insertAttempts = 0
        const maxAttempts = 3
        let insertError: any = null
        
        while (insertAttempts < maxAttempts) {
          if (insertAttempts > 0) {
            await new Promise(resolve => setTimeout(resolve, 200 * insertAttempts))
          }
          
          const result = await supabase.from(mapTable).insert({
            [mapTargetField]: targetId,
            [mapNodeField]: id
          })
          
          insertError = result.error
          
          if (!insertError) {
            console.log("INSERT succeeded on attempt", insertAttempts + 1)
            break
          }
          
          if (insertError.code !== "23505" && !insertError.message?.includes("duplicate") && !insertError.message?.includes("unique")) {
            break
          }
          
          insertAttempts++
        }
        
        if (insertError) {
          console.error("Error inserting yacht assignment after retries:", insertError)
          
          if (insertError.code === "23505" || insertError.message?.includes("duplicate") || insertError.message?.includes("unique")) {
            // Try UPDATE as fallback
            const { data: updateData, error: updateError } = await supabase
              .from(mapTable)
              .update({ [mapNodeField]: id })
              .eq(mapTargetField, targetId)
              .select()
            
            if (updateError) {
              console.error("UPDATE also failed:", updateError)
              const { data: reloadData } = await supabase
                .from(mapTable)
                .select(mapNodeField)
                .eq(mapTargetField, targetId)
              if (reloadData) {
                setChecked((reloadData as any[])?.map(r => r[mapNodeField]) ?? [])
              } else {
                setChecked([])
              }
            }
          } else {
            setChecked([])
          }
        }
      } else {
        // Standard many-to-many upsert
        const payload = [{ [mapTargetField]: targetId, [mapNodeField]: id }]

        const { error } = await supabase.from(mapTable).upsert(payload)

        if (error) {
          console.error("Error upserting assignment:", error)
          // Resync from DB so UI matches server state
          const { data: reloadData } = await supabase
            .from(mapTable)
            .select(mapNodeField)
            .eq(mapTargetField, targetId)
          setChecked((reloadData as any[])?.map((r) => r[mapNodeField]) ?? [])
        }
      }
    } else {
      // Unchecking/unassigning
      if (useRadioButtons) {
        // Radio button mode: delete assignment for this yacht (clear selection)
        const { error } = await supabase
          .from(mapTable)
          .delete()
          .eq(mapTargetField, targetId)
        
        if (error) {
          console.error("Error deleting yacht assignment:", error)
          const { data: reloadData } = await supabase
            .from(mapTable)
            .select(mapNodeField)
            .eq(mapTargetField, targetId)
          if (reloadData) {
            setChecked((reloadData as any[])?.map(r => r[mapNodeField]) ?? [])
          } else {
            setChecked([])
          }
        }
      } else {
        // Checkbox mode: delete specific assignment
        const { error } = await supabase
          .from(mapTable)
          .delete()
          .eq(mapTargetField, targetId)
          .eq(mapNodeField, id)
        
        if (error) {
          console.error("Error deleting assignment:", error)
          setChecked((prev) => [...prev, id])
        }
      }
    }
    
    setLoading(null)
  }

  return (
    <TreeDisplay
      nodes={nodes}
      renderActions={(node) => {
        const isVirtual = node.id.startsWith("__")

        if (useRadioButtons) {
          // Radio button mode: only one selection allowed
          const isChecked = checked.includes(node.id)

          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="radio"
                name={`${mapTable}-${targetId}`} // Same name for all radios = only one selectable
                checked={isChecked}
                disabled={isVirtual || loading === node.id || (isUserGroupAssignment && !isAdmin)}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                onChange={(e) => {
                  e.stopPropagation()
                  if (!isVirtual && (!isUserGroupAssignment || isAdmin)) {
                    toggle(node.id)
                  } else if (isUserGroupAssignment && !isAdmin) {
                    alert("User-group assignment is restricted. Only administrators can modify user-group memberships.")
                  }
                }}
              />

              {editBasePath && !isVirtual && (
                <div
                  className="tree-action-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`${editBasePath}/${node.id}`)
                  }}
                >
                  <Pencil size={14} />
                </div>
              )}
            </div>
          )
        } else {
          // Checkbox mode: explicit membership only (no upward inheritance).
          const isChecked = checked.includes(node.id)

          return (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isVirtual || loading === node.id || (isUserGroupAssignment && !isAdmin)}
                ref={(el) => {
                  if (el) el.indeterminate = false
                }}
                onClick={(e) => {
                  e.stopPropagation()
                }}
                onChange={(e) => {
                  e.stopPropagation()
                  if (!isVirtual && (!isUserGroupAssignment || isAdmin)) {
                    toggle(node.id)
                  } else if (isUserGroupAssignment && !isAdmin) {
                    alert("User-group assignment is restricted. Only administrators can modify user-group memberships.")
                  }
                }}
              />

              {editBasePath && !isVirtual && (
                <div
                  className="tree-action-icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`${editBasePath}/${node.id}`)
                  }}
                >
                  <Pencil size={14} />
                </div>
              )}
            </div>
          )
        }
      }}
    />
  )
}
