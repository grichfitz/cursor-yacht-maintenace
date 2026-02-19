export type TaskIncidentStatus = "pending" | "completed" | "cancelled"

export type TaskIncidentRow = {
  id: string
  assignment_id: string
  yacht_id: string
  due_date: string // date
  status: TaskIncidentStatus
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

