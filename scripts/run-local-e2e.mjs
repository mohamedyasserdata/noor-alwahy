import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = resolve(projectRoot, "node_modules/supabase/dist/supabase.js");
const playwrightCliPath = resolve(projectRoot, "node_modules/@playwright/test/cli.js");
const statusSchema = z.object({
  API_URL: z.url({ protocol: /^https?$/ }),
  PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
  SERVICE_ROLE_KEY: z.string().min(1),
});
const statusResult = spawnSync(process.execPath, [cliPath, "status", "--output", "json"], {
  cwd: projectRoot,
  encoding: "utf8",
  env: { ...process.env, DO_NOT_TRACK: process.env.DO_NOT_TRACK ?? "1" },
});

if (statusResult.status !== 0 || !statusResult.stdout.trim()) {
  if (statusResult.stderr) process.stderr.write(statusResult.stderr);
  throw new Error("Unable to read the local Supabase test environment.");
}

const status = statusSchema.parse(JSON.parse(statusResult.stdout));
const localChromium = findLocalChromium();
const localPricingAccessKey = "local_pricing_preview_9F4k2Lm7Qx";
const playwrightArgs = ["test", "--project=chromium", ...process.argv.slice(2)];
const testResult = spawnSync(process.execPath, [playwrightCliPath, ...playwrightArgs], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    APPLICATION_LOOKUP_PEPPER: "local-only-e2e-application-pepper",
    E2E_LOCAL_TESTS: "1",
    E2E_PRIVATE_PRICING_ACCESS_KEY: localPricingAccessKey,
    PRIVATE_PRICING_ACCESS_KEY: localPricingAccessKey,
    PUPPETEER_EXECUTABLE_PATH: localChromium,
  },
});

if (testResult.error) {
  process.stderr.write(`${testResult.error.message}\n`);
}

process.exit(testResult.status ?? 1);

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
  if (!executable) throw new Error("No local Chromium executable is available for E2E PDF routes.");
  return executable;
}
