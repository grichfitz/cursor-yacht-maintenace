export type GlobalCategoryRow = {
  id: string
  parent_category_id: string | null
  name: string
  archived_at: string | null
  created_at: string
}

export type TaskTemplateRow = {
  id: string
  global_category_id: string
  name: string
  description: string | null
  period: string | null
  metadata: any | null
  archived_at: string | null
  created_at: string
}

