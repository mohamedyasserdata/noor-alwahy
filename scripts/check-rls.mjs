import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(projectRoot, "node_modules/supabase/dist/supabase.js");
const testPath = "supabase/tests/database/rls_enabled.test.sql";

const result = spawnSync(process.execPath, [cliPath, "test", "db", "--local", testPath], {
  cwd: projectRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1",
  },
});

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(result.status ?? 1);
