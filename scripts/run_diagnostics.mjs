import pg from "pg";

const { Client } = pg;

const TEMPLATE_ID = "9210cabb-d76f-4ee3-966f-56e2d87f6dab";

function requireDbUrl() {
  const dbUrl =
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!dbUrl) {
    console.error(
      [
        "Missing database connection string.",
        "",
        "Set one of these environment variables to your Supabase Postgres URL:",
        "- SUPABASE_DB_URL",
        "- DATABASE_URL",
        "- POSTGRES_URL",
        "",
        "Example (PowerShell):",
        "  $env:SUPABASE_DB_URL = \"postgresql://...\"",
        "  npm run diagnostics",
      ].join("\n"),
    );
    process.exit(1);
  }

  return dbUrl;
}

async function runQuery(client, title, sql, params = []) {
  console.log("\n=== " + title + " ===");
  const res = await client.query(sql, params);
  if (res.rows?.length) console.table(res.rows);
  else console.log("(no rows)");
}

async function main() {
  const connectionString = requireDbUrl();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    // STEP 1 — INSTANCE OWNERSHIP
    await runQuery(
      client,
      "Step 1: Instance ownership by template name + status",
      `
      select t.name, ti.status, count(*)
      from task_instances ti
      join task_templates t on t.id = ti.template_id
      group by t.name, ti.status
      order by t.name;
      `,
    );

    // STEP 2 — ALL TEMPLATE LINKS
    await runQuery(
      client,
      "Step 2a: Template → Group links",
      `
      select t.name, g.name as group_name
      from template_group_links tgl
      join task_templates t on t.id = tgl.template_id
      join groups g on g.id = tgl.group_id;
      `,
    );

    await runQuery(
      client,
      "Step 2b: Template → Yacht links",
      `
      select t.name, y.name as yacht_name
      from template_yacht_links tyl
      join task_templates t on t.id = tyl.template_id
      join yachts y on y.id = tyl.yacht_id;
      `,
    );

    // Helpful focus queries for the template shown in screenshots.
    await runQuery(
      client,
      `Focus: Status breakdown for template_id = ${TEMPLATE_ID}`,
      `
      select ti.status, count(*)
      from task_instances ti
      where ti.template_id = $1
      group by ti.status
      order by ti.status;
      `,
      [TEMPLATE_ID],
    );

    await runQuery(
      client,
      `Focus: Direct group/yacht links for template_id = ${TEMPLATE_ID}`,
      `
      select 'group' as link_type, g.id as linked_id, g.name as linked_name
      from template_group_links tgl
      join groups g on g.id = tgl.group_id
      where tgl.template_id = $1
      union all
      select 'yacht' as link_type, y.id as linked_id, y.name as linked_name
      from template_yacht_links tyl
      join yachts y on y.id = tyl.yacht_id
      where tyl.template_id = $1
      order by link_type, linked_name;
      `,
      [TEMPLATE_ID],
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\nDiagnostics failed:", err?.message ?? err);
  process.exit(1);
});

