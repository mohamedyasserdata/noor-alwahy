import type { Metadata } from "next";

import { amiriArabic, amiriLatin, cairoArabic, cairoLatin } from "@/app/fonts";
import arMessages from "@/messages/ar.json";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: arMessages.meta.title,
    template: `%s | ${arMessages.meta.title}`,
  },
  description: arMessages.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairoArabic.variable} ${cairoLatin.variable} ${amiriArabic.variable} ${amiriLatin.variable}`}
    >
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
