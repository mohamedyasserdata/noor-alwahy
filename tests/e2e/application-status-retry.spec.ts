import { expect, test } from "@playwright/test";

test("application lookup keeps input and retries after a failed connection", async ({ page }) => {
  await page.goto("/en/order-status");
  await page.locator("#order_no").fill("NW-A-12345");
  await page.locator("#identifier").fill("lookup@example.invalid");
  const button = page.getByRole("button", { name: "Check status" });
  await page.route("**/api/applications/status", (route) => route.abort());
  await button.click();
  await expect(page.locator("form").getByRole("alert")).toContainText("try again");
  await expect(page.locator("#identifier")).toHaveValue("lookup@example.invalid");
  await page.unroute("**/api/applications/status");
  await page.route("**/api/applications/status", (route) =>
    route.fulfill({ status: 404, json: { error: "not_found" } }),
  );
  await button.click();
  await expect(page.locator("form").getByRole("alert")).toContainText("No matching application");
  await expect(button).toBeEnabled();
});
