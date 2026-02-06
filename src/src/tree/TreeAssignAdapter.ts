const TreeAssignAdapter = {} as {
  targetId: string

  loadAssignments(): Promise<string[]>

  assign(nodeId: string): Promise<void>
  unassign(nodeId: string): Promise<void>

  editPath?: (nodeId: string) => string | null
}

export default TreeAssignAdapter
