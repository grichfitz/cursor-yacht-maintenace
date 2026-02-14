import dotenv from "dotenv";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const { Client } = pg;

// Load env vars for local/dev usage (safe with .gitignore).
// Prefer .env.local, then fall back to default .env behavior.
dotenv.config({ path: ".env.local" });
dotenv.config();

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
        '  $env:SUPABASE_DB_URL = "postgresql://..."',
        "  npm run seed:random-tasks",
      ].join("\n"),
    );
    process.exit(1);
  }

  return dbUrl;
}

function getSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
}

function getSupabaseServiceKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY
  );
}

function explainDbDnsFailure(err) {
  const msg = String(err?.message ?? err ?? "");
  if (!msg.includes("ENOTFOUND")) return null;

  return [
    "DNS error resolving the Supabase DB host.",
    "",
    "This usually means your network/DNS can’t resolve the `db.<ref>.supabase.co` hostname.",
    "Fix options:",
    "- In Supabase Dashboard → Project Settings → Database → Connection string: use the provided host exactly",
    "- Try the Transaction Pooler connection string (often uses a `*.pooler.supabase.com` host)",
    "- Or use HTTP seeding mode (recommended): set SUPABASE_SERVICE_ROLE_KEY in .env.local",
  ].join("\n");
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSomeUnique(arr, count) {
  const out = new Set();
  const n = Math.min(count, arr.length);
  while (out.size < n) out.add(pickRandom(arr));
  return Array.from(out);
}

function randInt(min, maxInclusive) {
  const n = Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  return n;
}

const WORDS = [
  "Inspect",
  "Check",
  "Clean",
  "Test",
  "Service",
  "Verify",
  "Replace",
  "Calibrate",
  "Lubricate",
  "Tighten",
  "Review",
  "Secure",
  "Audit",
  "Log",
  "Measure",
  "Confirm",
];

const SUBJECTS = [
  "bilge pump",
  "prop",
  "engine bay",
  "battery bank",
  "shore power",
  "navigation lights",
  "fresh water",
  "fire extinguishers",
  "safety gear",
  "anchor winch",
  "fuel filter",
  "oil level",
  "coolant",
  "steering",
  "hull",
  "deck fittings",
  "life raft",
  "generator",
  "radio",
  "AIS",
];

function makeTaskName(existing) {
  // Avoid collisions in UI lists by adding a short suffix.
  const base = `${pickRandom(WORDS)} ${pickRandom(SUBJECTS)}`;
  const suffix = randInt(10, 99);
  const name = `${base} (${suffix})`;
  if (!existing.has(name)) return name;
  // If collision, retry once.
  const suffix2 = randInt(100, 999);
  return `${base} (${suffix2})`;
}

async function seedViaPostgres({ templateCount, doRecalc }) {
  const connectionString = requireDbUrl();
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const groupsRes = await client.query(
      `select id, name from public.groups where coalesce(is_archived, false) = false order by name;`,
    );
    const yachtsRes = await client.query(
      `select id, name from public.yachts order by name;`,
    );

    const groups = groupsRes.rows || [];
    const yachts = yachtsRes.rows || [];

    if (groups.length === 0) throw new Error("No groups found. Create groups first.");
    if (yachts.length === 0) throw new Error("No yachts found. Create yachts first.");

    console.log(`Found ${groups.length} groups and ${yachts.length} yachts.`);

    const created = [];
    const usedNames = new Set();

    // Choose 1–2 templates to also link directly to yachts.
    const directYachtLinkCount = Math.min(2, Math.max(1, Math.floor(templateCount / 10)));
    const directYachtLinkTemplateIndexes = new Set(
      pickSomeUnique(
        Array.from({ length: templateCount }, (_, i) => i),
        directYachtLinkCount,
      ),
    );

    for (let i = 0; i < templateCount; i++) {
      const name = makeTaskName(usedNames);
      usedNames.add(name);

      const intervalDays = [null, 7, 14, 30, 60, 90][randInt(0, 5)];
      const description = `Seeded ${new Date().toISOString().slice(0, 10)} — auto-generated.`;

      const ins = await client.query(
        `
        insert into public.task_templates (name, description, interval_days, category_id, default_group_id)
        values ($1, $2, $3, null, null)
        returning id;
        `,
        [name, description, intervalDays],
      );

      const templateId = ins.rows?.[0]?.id;
      if (!templateId) throw new Error("Insert succeeded but no template id returned.");

      // Link to 1–3 random groups.
      const groupPickCount = randInt(1, Math.min(3, groups.length));
      const pickedGroups = pickSomeUnique(groups, groupPickCount);

      for (const g of pickedGroups) {
        await client.query(
          `insert into public.template_group_links (template_id, group_id) values ($1, $2);`,
          [templateId, g.id],
        );
      }

      // Optionally add a direct yacht link for a couple templates.
      if (directYachtLinkTemplateIndexes.has(i)) {
        const pickedYacht = pickRandom(yachts);
        await client.query(
          `insert into public.template_yacht_links (template_id, yacht_id) values ($1, $2);`,
          [templateId, pickedYacht.id],
        );
      }

      created.push({ templateId, name, groups: pickedGroups.map((g) => g.name) });
    }

    console.log(`\nCreated ${created.length} task templates.`);
    console.log(
      created
        .slice(0, 8)
        .map((t) => `- ${t.name}  →  ${t.groups.join(", ")}`)
        .join("\n"),
    );
    if (created.length > 8) console.log(`…and ${created.length - 8} more.`);

    if (doRecalc) {
      console.log("\nRecalculating task instances via generate_task_instances()…");
      await client.query(`select public.generate_task_instances();`);
      console.log("Done.");
    } else {
      console.log(
        "\nNote: not recalculating task instances. To do that, re-run with --recalc (or set SEED_RECALC=1).",
      );
    }
  } finally {
    await client.end();
  }
}

async function seedViaHttp({ templateCount, doRecalc }) {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceKey();

  if (!url) {
    throw new Error(
      [
        "Missing Supabase URL for HTTP mode.",
        "Set SUPABASE_URL (or VITE_SUPABASE_URL) in .env.local.",
      ].join("\n"),
    );
  }

  if (!serviceKey) {
    throw new Error(
      [
        "Missing service role key for HTTP mode.",
        "",
        "Add this to `.env.local` (do NOT commit it):",
        '  SUPABASE_SERVICE_ROLE_KEY="...your service role key..."',
        "",
        "Then re-run:",
        "  npm run seed:random-tasks -- --recalc",
      ].join("\n"),
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: groups, error: gErr } = await supabase
    .from("groups")
    .select("id,name,is_archived")
    .order("name");
  if (gErr) throw gErr;

  const activeGroups = (groups ?? []).filter((g) => !g.is_archived);
  if (activeGroups.length === 0) throw new Error("No groups found. Create groups first.");

  const { data: yachts, error: yErr } = await supabase
    .from("yachts")
    .select("id,name")
    .order("name");
  if (yErr) throw yErr;
  if ((yachts?.length ?? 0) === 0) throw new Error("No yachts found. Create yachts first.");

  console.log(`Found ${activeGroups.length} groups and ${yachts.length} yachts.`);

  const created = [];
  const usedNames = new Set();

  const directYachtLinkCount = Math.min(2, Math.max(1, Math.floor(templateCount / 10)));
  const directYachtLinkTemplateIndexes = new Set(
    pickSomeUnique(
      Array.from({ length: templateCount }, (_, i) => i),
      directYachtLinkCount,
    ),
  );

  for (let i = 0; i < templateCount; i++) {
    const name = makeTaskName(usedNames);
    usedNames.add(name);

    const intervalDays = [null, 7, 14, 30, 60, 90][randInt(0, 5)];
    const description = `Seeded ${new Date().toISOString().slice(0, 10)} — auto-generated.`;

    const { data: ins, error: insErr } = await supabase
      .from("task_templates")
      .insert({
        name,
        description,
        interval_days: intervalDays,
        category_id: null,
        default_group_id: null,
      })
      .select("id")
      .single();

    if (insErr) throw insErr;
    const templateId = ins?.id;
    if (!templateId) throw new Error("Insert succeeded but no template id returned.");

    const groupPickCount = randInt(1, Math.min(3, activeGroups.length));
    const pickedGroups = pickSomeUnique(activeGroups, groupPickCount);

    const { error: linkErr } = await supabase.from("template_group_links").insert(
      pickedGroups.map((g) => ({ template_id: templateId, group_id: g.id })),
    );
    if (linkErr) throw linkErr;

    if (directYachtLinkTemplateIndexes.has(i)) {
      const pickedYacht = pickRandom(yachts);
      const { error: ylErr } = await supabase
        .from("template_yacht_links")
        .insert({ template_id: templateId, yacht_id: pickedYacht.id });
      if (ylErr) throw ylErr;
    }

    created.push({ templateId, name, groups: pickedGroups.map((g) => g.name) });
  }

  console.log(`\nCreated ${created.length} task templates.`);
  console.log(
    created
      .slice(0, 8)
      .map((t) => `- ${t.name}  →  ${t.groups.join(", ")}`)
      .join("\n"),
  );
  if (created.length > 8) console.log(`…and ${created.length - 8} more.`);

  if (doRecalc) {
    console.log("\nRecalculating task instances via generate_task_instances()…");
    const { error: rpcErr } = await supabase.rpc("generate_task_instances");
    if (rpcErr) throw rpcErr;
    console.log("Done.");
  } else {
    console.log(
      "\nNote: not recalculating task instances. To do that, re-run with --recalc (or set SEED_RECALC=1).",
    );
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const templateCount = Number.parseInt(process.env.SEED_TASK_COUNT || "20", 10) || 20;
  const doRecalc = args.has("--recalc") || process.env.SEED_RECALC === "1";

  // Prefer direct Postgres if available; fall back to HTTP mode if DB networking fails.
  const hasDbUrl = !!(
    process.env.SUPABASE_DB_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL
  );

  if (!hasDbUrl) {
    console.log("No SUPABASE_DB_URL detected; using Supabase HTTP seeding mode.");
    await seedViaHttp({ templateCount, doRecalc });
    return;
  }

  try {
    await seedViaPostgres({ templateCount, doRecalc });
  } catch (err) {
    const hint = explainDbDnsFailure(err);
    if (hint) {
      console.error("\n" + hint + "\n");
      console.error("Falling back to Supabase HTTP seeding mode…\n");
      await seedViaHttp({ templateCount, doRecalc });
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  console.error("\nSeed failed:", err?.message ?? err);
  process.exit(1);
});

