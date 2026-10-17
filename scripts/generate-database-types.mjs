import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "types/database.types.ts");
const temporaryPath = `${outputPath}.tmp`;
const cliPath = resolve(projectRoot, "node_modules/supabase/dist/supabase.js");

const result = spawnSync(
  process.execPath,
  [cliPath, "gen", "types", "typescript", "--local", "--schema", "public"],
  {
    cwd: projectRoot,
    encoding: "utf8",
  },
);

if (result.status !== 0 || !result.stdout.trim()) {
  rmSync(temporaryPath, { force: true });

  if (result.stdout) {
    process.stderr.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }

  throw new Error("Database type generation failed; the existing generated file was preserved.");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(temporaryPath, result.stdout, "utf8");
renameSync(temporaryPath, outputPath);
process.stdout.write(`Generated ${outputPath}\n`);
