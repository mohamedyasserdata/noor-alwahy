import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  outputFileTracingIncludes: {
    "/api/schedule/pdf": ["./app/fonts/*.woff2"],
  },
  partialPrefetching: true,
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core"],
  typedRoutes: true,
};

export default withNextIntl(nextConfig);
