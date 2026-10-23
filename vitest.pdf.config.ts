import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(process.cwd()) },
  },
  test: {
    environment: "node",
    include: [
      "scripts/generate-pdf-quality-samples.test.ts",
      "scripts/export-workbook-quality.test.ts",
    ],
    testTimeout: 120_000,
  },
});
