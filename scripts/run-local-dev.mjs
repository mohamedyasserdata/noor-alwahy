import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

import { chromium } from "@playwright/test";
import { z } from "zod";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const supabaseCli = require.resolve("supabase/dist/supabase.js");
const statusSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }),
  PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
  SERVICE_ROLE_KEY: z.string().min(1),
});
const runtimeEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ protocol: /^https?$/ }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});
const nextCommand = process.argv[2] === "build" ? "build" : "dev";
const nextArgs = nextCommand === "build" ? process.argv.slice(3) : process.argv.slice(2);
const localSupabaseEnv = resolveSupabaseEnv();
const localChromium = findLocalChromium();
const child = spawn(process.execPath, [nextCli, nextCommand, ...nextArgs], {
  env: {
    ...process.env,
    ...localSupabaseEnv,
    PUPPETEER_EXECUTABLE_PATH: localChromium,
  },
  stdio: "inherit",
});

function resolveSupabaseEnv() {
  const configured = runtimeEnvSchema.safeParse(process.env);
  return configured.success ? configured.data : ensureLocalSupabase();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

function ensureLocalSupabase() {
  let status = readLocalSupabaseStatus();
  if (!status) {
    process.stdout.write("Local Supabase is not running; starting it now...\n");
    const startResult = runSupabase(["start", "--output-format", "json", "--log-level", "error"]);
    if (startResult.status !== 0) {
      throw new Error(
        `Could not start local Supabase. Start Docker Desktop, wait until it is ready, then run pnpm ${nextCommand} again.`,
      );
    }
    status = readLocalSupabaseStatus();
  }

  if (!status) {
    throw new Error(
      `Local Supabase started without returning valid connection details. Run pnpm supabase:stop, then pnpm supabase:start, and retry pnpm ${nextCommand}.`,
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };
}

function readLocalSupabaseStatus() {
  const result = runSupabase(["status", "-o", "json", "--log-level", "error"]);
  if (result.status !== 0 || !result.stdout.trim()) return null;

  try {
    return statusSchema.parse(JSON.parse(result.stdout));
  } catch {
    return null;
  }
}

function runSupabase(args) {
  return spawnSync(process.execPath, [supabaseCli, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1" },
  });
}

function findLocalChromium() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : undefined,
    process.platform === "win32"
      ? "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
      : undefined,
    chromium.executablePath(),
  ];
  const executable = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!executable) throw new Error("No local Chromium executable is available.");
  return executable;
}
