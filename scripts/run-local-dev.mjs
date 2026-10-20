import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const localChromium = findLocalChromium();
const child = spawn(process.execPath, [nextCli, "dev", ...process.argv.slice(2)], {
  env: {
    ...process.env,
    PUPPETEER_EXECUTABLE_PATH: localChromium,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

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
