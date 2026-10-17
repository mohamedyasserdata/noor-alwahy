import { spawnSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";

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
    env: {
      ...process.env,
      DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1",
    },
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
const prettierConfig = await resolveConfig(outputPath);
const formattedTypes = await format(result.stdout, {
  ...prettierConfig,
  filepath: outputPath,
});
writeFileSync(temporaryPath, formattedTypes, "utf8");
renameSync(temporaryPath, outputPath);
process.stdout.write(`Generated ${outputPath}\n`);
