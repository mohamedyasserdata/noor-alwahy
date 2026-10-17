import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(projectRoot, "node_modules/supabase/dist/supabase.js");
const statusSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }),
  PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
});

const result = spawnSync(process.execPath, [cliPath, "status", "--output", "json"], {
  cwd: projectRoot,
  encoding: "utf8",
  env: {
    ...process.env,
    DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1",
  },
});

if (result.status !== 0 || !result.stdout.trim()) {
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
  }

  throw new Error("Unable to read the local Supabase public environment.");
}

const status = statusSchema.parse(JSON.parse(result.stdout));
process.stdout.write(`NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}\n`);
process.stdout.write(`NEXT_PUBLIC_SUPABASE_ANON_KEY=${status.PUBLISHABLE_KEY}\n`);
