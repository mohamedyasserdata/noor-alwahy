import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const supabaseCli = resolve(projectRoot, "node_modules", "supabase", "dist", "supabase.js");
const environment = {
  ...process.env,
  DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1",
};

let testStatus = 1;
let restoreStatus = 1;

try {
  testStatus = runTests();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
} finally {
  const restore = runSupabase(["db", "reset", "--local"]);
  restoreStatus = restore.status ?? 1;
  if (restoreStatus !== 0) {
    process.stderr.write("Failed to restore the full local development seed.\n");
  }
}

process.exit(restoreStatus === 0 ? testStatus : restoreStatus);

function runTests() {
  requireSuccess(runSupabase(["db", "reset", "--local", "--no-seed"]), "database reset");
  requireSuccess(loadAuthFixtures(), "authentication fixture load");
  return runSupabase(["test", "db", "--local"]).status ?? 1;
}

function runSupabase(args) {
  return spawnSync(process.execPath, [supabaseCli, ...args], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
}

function loadAuthFixtures() {
  const sql = readFileSync(resolve(projectRoot, "supabase", "seed.sql"));
  return spawnSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_noor-alwahy",
      "psql",
      "--username",
      "postgres",
      "--dbname",
      "postgres",
      "--set",
      "ON_ERROR_STOP=1",
    ],
    {
      cwd: projectRoot,
      env: environment,
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    },
  );
}

function requireSuccess(result, label) {
  if (result.error) throw result.error;
  if ((result.status ?? 1) !== 0) throw new Error(`${label} failed.`);
}
