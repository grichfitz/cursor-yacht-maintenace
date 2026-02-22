import React from "react"

export type DataTableColumn<T> = {
  key: string
  header: string
  width?: number | string
  render: (row: T) => React.ReactNode
}

type DataTableProps<T> = {
  rows: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string
  emptyLabel?: string
}

export default function DataTable<T>({ rows, columns, rowKey, emptyLabel }: DataTableProps<T>) {
  if (!rows.length) {
    return <div className="admin-empty">{emptyLabel ?? "No rows returned by RLS."}</div>
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

