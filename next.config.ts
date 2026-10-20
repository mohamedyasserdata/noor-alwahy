import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  outputFileTracingIncludes: {
    "/api/calendar/pdf": ["./node_modules/@fontsource-variable/cairo/files/*.woff2"],
  },
  partialPrefetching: true,
  typedRoutes: true,
};

export default withNextIntl(nextConfig);
