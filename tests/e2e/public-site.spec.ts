import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const locales = [
  { code: "ar", direction: "rtl", other: "en" },
  { code: "en", direction: "ltr", other: "ar" },
] as const;
const viewports = [
  { name: "mobile", width: 360, height: 800 },
  { name: "desktop", width: 1280, height: 900 },
] as const;
const publicPaths = ["", "/tracks", "/packages", "/faq", "/contact"] as const;
const packageSlug = "public-site-e2e";
const packageNameAr = "باقة اختبار الموقع الثابتة";
const packageNameEn = "Stable public site test package";

function createLocalAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey)
    throw new Error("Public site test requires the local Supabase environment.");

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

test.beforeAll(async () => {
  const supabase = createLocalAdminClient();
  const { data: existingPackage, error: lookupError } = await supabase
    .from("packages")
    .select("id")
    .eq("slug", packageSlug)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const packageId = existingPackage?.id ?? randomUUID();
  if (!existingPackage) {
    const { error: packageError } = await supabase.from("packages").insert({
      id: packageId,
      slug: packageSlug,
      name_ar: packageNameAr,
      name_en: packageNameEn,
      description_ar: "باقة منشورة لاختبار عرض السعر الحقيقي حسب الدولة.",
      description_en: "A published fixture for real country-aware pricing.",
      audience: "adult",
      sessions_per_week: 2,
      duration_min: 45,
      features: [{ ar: "متابعة واضحة", en: "Clear follow-up", icon: "star" }],
    });
    if (packageError) throw packageError;
  }

  const { data: existingPrices, error: priceLookupError } = await supabase
    .from("package_prices")
    .select("country_code")
    .eq("package_id", packageId)
    .in("country_code", ["ZZ", "EG"]);
  if (priceLookupError) throw priceLookupError;
  const existingCountryCodes = new Set(existingPrices.map(({ country_code }) => country_code));
  const missingPrices = [
    { package_id: packageId, country_code: "ZZ", currency: "USD", amount: 40 },
    { package_id: packageId, country_code: "EG", currency: "EGP", amount: 900 },
  ].filter(({ country_code }) => !existingCountryCodes.has(country_code));
  if (missingPrices.length > 0) {
    const { error: priceError } = await supabase.from("package_prices").insert(missingPrices);
    if (priceError) throw priceError;
  }

  const { error: publishError } = await supabase
    .from("packages")
    .update({ is_published: true })
    .eq("id", packageId);
  if (publishError) throw publishError;
});

for (const locale of locales) {
  for (const viewport of viewports) {
    test(`${locale.code} public site stays accessible at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.setExtraHTTPHeaders({ "x-vercel-ip-country": "EG" });

      for (const path of publicPaths) {
        await page.goto(`/${locale.code}${path}`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale.direction);
        await expect(page.locator("main#main-content")).toBeVisible();
        await expect(page.locator('link[rel="alternate"][hreflang="ar"]')).toHaveCount(1);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);

        const dimensions = await page.evaluate(() => ({
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBe(dimensions.innerWidth);
      }

      await page.goto(`/${locale.code}/packages`);
      const expectedPackageName = locale.code === "ar" ? packageNameAr : packageNameEn;
      const packageCard = page.locator("article").filter({ hasText: expectedPackageName });
      await expect(packageCard.getByText(expectedPackageName)).toBeVisible();
      await expect(packageCard.getByText(/900/)).toBeVisible();

      if (locale.code === "ar" && viewport.name === "mobile") {
        await page.getByLabel("دولة السعر").selectOption("SA");
        await page.getByRole("button", { name: "تحديث السعر" }).click();
        await expect(page).toHaveURL(/\/ar\/packages$/);
        await expect(packageCard.getByText(/40\.00\s+US\$/)).toBeVisible();
        expect(
          (await page.context().cookies()).find(({ name }) => name === "nw_country")?.value,
        ).toBe("SA");
      }

      await page.goto(`/${locale.code}/tracks?source=public-test`);
      await page.locator(`nav a[lang="${locale.other}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${locale.other}/tracks\\?source=public-test$`));
    });
  }
}
