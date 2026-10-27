import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

import { signInAs, testAccounts } from "./helpers/auth";

const mailpitUrl = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

for (const locale of [
  { code: "ar", direction: "rtl", homeLabel: "العودة للرئيسية", loginTitle: "تسجيل الدخول" },
  { code: "en", direction: "ltr", homeLabel: "Back to home", loginTitle: "Sign in" },
] as const) {
  test(`${locale.code} protects portals and renders an accessible login`, async ({ page }) => {
    const consoleProblems = captureConsoleProblems(page);
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/${locale.code}/admin/dashboard`);

    await expect(page).toHaveURL(
      new RegExp(`/${locale.code}/auth/login\\?next=.*admin.*dashboard`),
    );
    await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
    await expect(page.getByRole("heading", { level: 2, name: locale.loginTitle })).toBeVisible();
    await expect(page.locator("#email")).toHaveAttribute("autocomplete", "username");
    await expect(page.locator("#password")).toHaveAttribute("autocomplete", "current-password");
    const homeLink = page.locator("#main-content").getByRole("link", { name: locale.homeLabel });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute("href", `/${locale.code}`);
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page);
    expect(consoleProblems).toEqual([]);

    await homeLink.click();
    await expect(page).toHaveURL(new RegExp(`/${locale.code}$`));
  });
}

test("invalid credentials stay generic", async ({ page }) => {
  await page.goto("/en/auth/login");
  await page.locator("#email").fill("unknown@noor.local");
  await page.locator("#password").fill("WrongPassword1!");
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/en\/auth\/login\?error=invalid_credentials$/);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "The sign-in details are incorrect.",
  );
});

test("US-010 routes a teacher to the teacher portal and rejects the admin portal", async ({
  page,
}) => {
  await signInAs(page, "en", "teacher");
  await page.goto("/en/admin/dashboard");

  await expect(page).toHaveURL(/\/en\/teacher\/today$/);
  await expect(page.getByRole("heading", { level: 1, name: "My sessions today" })).toBeVisible();
});

test("account settings signs out the current browser and returns home", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signInAs(page, "en", "teacher");

  const accountMenu = page.getByTestId("account-menu").filter({ visible: true });
  await accountMenu.locator("summary").click();
  const accountDetails = accountMenu.locator("dl");
  await expect(accountDetails.getByText(testAccounts.teacher.email, { exact: true })).toBeVisible();
  await expect(accountDetails.getByText("Teacher", { exact: true })).toBeVisible();
  await expect(accountDetails.getByRole("definition").last()).toHaveText(/^\w+\/\w+$/);

  await accountMenu.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
  await expect(
    page.getByRole("heading", {
      name: "An inspiring Quran journey begins right here",
    }),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).filter(({ name }) => name.includes("auth-token")),
  ).toEqual([]);

  await page.goto("/en/auth/login");
  await page.locator("#email").fill(testAccounts.student.email);
  await page.locator("#password").fill("AcademyTest1!");
  const loginForm = page.locator("form").filter({ has: page.locator("#password") });
  await loginForm.getByRole("button", { name: "Open my portal" }).click();
  await expect(page).toHaveURL(/\/en\/student\/home$/);
});

test("US-011 completes password recovery without revealing account existence", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  const newPassword = `Academy-${testInfo.retry + 2}-${randomUUID()}!`;
  const messagesBeforeResponse = await page.request.get(`${mailpitUrl}/api/v1/messages`);
  const messagesBefore = (await messagesBeforeResponse.json()) as {
    messages: Array<{ ID: string }>;
  };
  const existingMessageIds = new Set(messagesBefore.messages.map(({ ID }) => ID));

  await page.goto("/en/auth/forgot-password");
  await page.locator("#email").fill(testAccounts.recovery.email);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL(/\/en\/auth\/forgot-password\?status=sent$/);
  await expect(page.locator('[data-slot="alert"]')).toContainText(
    "If the email belongs to an account, recovery instructions will arrive shortly.",
  );

  let recoveryMessageId: string | undefined;
  await expect
    .poll(async () => {
      const messagesResponse = await page.request.get(`${mailpitUrl}/api/v1/messages`);
      const messageList = (await messagesResponse.json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      recoveryMessageId = messageList.messages.find(
        (message) =>
          !existingMessageIds.has(message.ID) &&
          message.To.some(({ Address }) => Address === testAccounts.recovery.email),
      )?.ID;
      return recoveryMessageId;
    })
    .toBeTruthy();

  const messageResponse = await page.request.get(
    `${mailpitUrl}/api/v1/message/${recoveryMessageId}`,
  );
  expect(messageResponse.ok()).toBe(true);
  const message = (await messageResponse.json()) as { Text: string };
  const recoveryLink = message.Text.match(/https?:\/\/\S+(?=\s\))/)?.[0];
  expect(recoveryLink).toBeDefined();

  await page.goto(recoveryLink ?? "about:blank");
  await expect(page).toHaveURL(/\/en\/auth\/reset-password$/);
  const sessionCookies = (await page.context().cookies()).filter(({ name }) =>
    name.endsWith("auth-token"),
  );
  expect(sessionCookies.length).toBeGreaterThan(0);
  const resetForm = page.locator("form").filter({ has: page.locator("#passwordConfirm") });
  await resetForm.locator("#password").fill(newPassword);
  await resetForm.locator("#passwordConfirm").fill(newPassword);
  await resetForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/auth\/login\?status=password_updated$/);

  const loginForm = page
    .locator("form")
    .filter({ has: page.locator('input[autocomplete="current-password"]') });
  await loginForm.locator("#email").fill(testAccounts.recovery.email);
  await loginForm.locator("#password").fill(newPassword);
  await loginForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/en\/student\/home$/);
});

function captureConsoleProblems(page: Page) {
  const problems: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      problems.push(`${message.type()}: ${message.text()}`);
    }
  });

  return problems;
}

async function expectNoHorizontalOverflow(page: Page) {
  const viewport = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(viewport.scrollWidth).toBe(viewport.innerWidth);
}

async function expectTouchTargets(page: Page) {
  const undersizedTargets = await page
    .locator("main a:visible, main button:visible, header a:visible, header button:visible")
    .evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            height: rect.height,
            label: element.getAttribute("aria-label") ?? element.textContent?.trim(),
            width: rect.width,
          };
        })
        .filter(({ height, width }) => width < 44 || height < 44),
    );

  expect(undersizedTargets).toEqual([]);
}
