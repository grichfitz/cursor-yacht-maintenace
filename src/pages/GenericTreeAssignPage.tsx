import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import TreeDisplay from "../components/TreeDisplay"
import { Pencil } from "lucide-react"
import { supabase } from "../lib/supabase"

type Props = {
  targetId: string
  nodes: { id: string; parentId: string | null; label: string }[]
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
  const [checked, setChecked] = useState<string[]>([])

  useEffect(() => {
    supabase
      .from(mapTable)
      .select(mapNodeField)
      .eq(mapTargetField, targetId)
      .then(({ data }) => {
        setChecked((data as any[])?.map(r => r[mapNodeField]) ?? [])
      })
  }, [targetId])

  const childrenMap = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const n of nodes) {
      if (!n.parentId) continue
      if (!map[n.parentId]) map[n.parentId] = []
      map[n.parentId].push(n.id)
    }
    return map
  }, [nodes])

  const getDescendants = (id: string): string[] => {
    const kids = childrenMap[id] || []
    return kids.flatMap(k => [k, ...getDescendants(k)])
  }

  const toggle = async (id: string) => {
    const shouldCheck = !checked.includes(id)

    setChecked(prev =>
      shouldCheck ? [...prev, id] : prev.filter(x => x !== id)
    )

    if (shouldCheck) {
      await supabase.from(mapTable).upsert({
        [mapTargetField]: targetId,
        [mapNodeField]: id
      })
    } else {
      await supabase
        .from(mapTable)
        .delete()
        .eq(mapTargetField, targetId)
        .eq(mapNodeField, id)
    }
  }

  return (
    <TreeDisplay
      nodes={nodes}
      renderActions={(node) => {
        const descendants = getDescendants(node.id)

        const allChildrenChecked =
  descendants.length > 0 &&
  descendants.every(x => checked.includes(x))


        const someChildrenChecked =
          descendants.some(x => checked.includes(x))

        const isChecked = checked.includes(node.id)
        const fullyChecked = isChecked || allChildrenChecked

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
<input
  type="checkbox"
  checked={fullyChecked}
  ref={(el) => {
    if (el) el.indeterminate = !fullyChecked && someChildrenChecked
  }}
  onClick={(e) => {
    e.stopPropagation()
    toggle(node.id)
  }}
/>

            {editBasePath && (
              <div
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
      }}
    />
  )
}
