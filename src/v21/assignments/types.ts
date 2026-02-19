export type TaskAssignmentRow = {
  id: string
  template_id: string | null
  parent_assignment_id: string | null
  group_id: string | null
  yacht_id: string | null
  name: string
  description: string | null
  period: string | null
  config: any | null
  is_override: boolean
  archived_at: string | null
  created_at: string
}

export type GroupRow = { id: string; name: string }
export type YachtRow = { id: string; name: string; group_id: string }

