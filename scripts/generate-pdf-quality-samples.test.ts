import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

test("generates the PDF quality-gate samples", async () => {
  await import("./generate-pdf-quality-samples");
  expect(true).toBe(true);
});
