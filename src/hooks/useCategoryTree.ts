import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { TreeNode } from "../components/TreeDisplay";

const ARCHIVE_ID = "__archive__";

export function useCategoryTree() {
  const [nodes, setNodes] = useState<TreeNode[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("task_categories")
      .select("id,name,parent_id,is_archived")
      .order("name");

    if (!data) return;

    const active: TreeNode[] = [];
    const archived: TreeNode[] = [];

    for (const c of data as any[]) {
      const node = {
        id: c.id,
        label: c.name,
        parentId: c.parent_id,
      };

      if (c.is_archived) archived.push(node);
      else active.push(node);
    }

    // virtual Archive root (bottom)
    if (archived.length) {
      active.push({
        id: ARCHIVE_ID,
        label: "Archive",
        parentId: null,
      });

      archived.forEach((a) => (a.parentId = ARCHIVE_ID));
      active.push(...archived);
    }

    setNodes(active);
  };

  useEffect(() => {
    load();

    // reload whenever auth state changes OR page remounts
    const sub = supabase.auth.onAuthStateChange(() => load());

    return () => {
      sub.data.subscription.unsubscribe();
    };
  }, []);

  return { nodes, ARCHIVE_ID };
}
