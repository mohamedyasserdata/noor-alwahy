import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const migrationDirectory = join(projectRoot, "supabase", "migrations");
const productRoots = ["app", "components", "lib"];
const failures = [];

function read(path) {
  return readFileSync(path, "utf8");
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const migrationFiles = readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort()
  .map((name) => join(migrationDirectory, name));
const migrationSql = migrationFiles.map(read).join("\n");

const publicTables = new Set(
  [
    ...migrationSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi),
  ].map((match) => match[1].toLowerCase()),
);

for (const table of publicTables) {
  const rlsPattern = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
    "i",
  );
  if (!rlsPattern.test(migrationSql)) failures.push(`public.${table}: RLS is not enabled`);
}

const functionPattern =
  /create\s+(?:or\s+replace\s+)?function\s+([^\s(]+)[\s\S]*?\bas\s+(\$[a-z0-9_]*\$)[\s\S]*?\2\s*;/gi;
for (const path of migrationFiles) {
  const sql = read(path);
  for (const match of sql.matchAll(functionPattern)) {
    const definition = match[0];
    if (/security\s+definer/i.test(definition) && !/set\s+search_path\s*=/i.test(definition)) {
      failures.push(
        `${relative(projectRoot, path)}: ${match[1]} is SECURITY DEFINER without fixed search_path`,
      );
    }
  }
}

for (const match of migrationSql.matchAll(
  /insert\s+into\s+storage\.buckets[\s\S]{0,250}?values\s*\([\s\S]{0,200}?\btrue\b/gi,
)) {
  failures.push(`storage bucket appears public near SQL offset ${match.index ?? 0}`);
}

const productFiles = productRoots.flatMap((root) =>
  walk(join(projectRoot, root)).filter((path) =>
    [".ts", ".tsx", ".js", ".mjs"].includes(extname(path)),
  ),
);
for (const path of productFiles) {
  const source = read(path);
  const normalized = relative(projectRoot, path).replaceAll("\\", "/");
  if (source.includes("SUPABASE_SERVICE_ROLE_KEY") && normalized !== "lib/supabase/admin.ts") {
    failures.push(
      `${normalized}: service-role environment key used outside server-only admin client`,
    );
  }
  if (/^["']use client["'];/m.test(source) && /supabase\/admin|createAdminClient/.test(source)) {
    failures.push(`${normalized}: client module imports the service-role client`);
  }
}

const adminClient = read(join(projectRoot, "lib", "supabase", "admin.ts"));
if (!/^import\s+["']server-only["'];/m.test(adminClient)) {
  failures.push("lib/supabase/admin.ts: missing server-only guard");
}

const nextConfig = read(join(projectRoot, "next.config.ts"));
for (const requiredDirective of [
  "Content-Security-Policy",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "X-Content-Type-Options",
  "Permissions-Policy",
  "Strict-Transport-Security",
]) {
  if (!nextConfig.includes(requiredDirective)) {
    failures.push(`next.config.ts: missing ${requiredDirective}`);
  }
}

if (failures.length > 0) {
  console.error("Static security contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Static security contract passed: ${publicTables.size} public tables, ${migrationFiles.length} migrations, ${productFiles.length} product files.`,
);
