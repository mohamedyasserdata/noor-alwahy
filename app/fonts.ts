import localFont from "next/font/local";

export const cairoArabic = localFont({
  src: "./fonts/cairo-arabic-variable.woff2",
  variable: "--font-cairo-arabic",
  display: "swap",
  weight: "200 1000",
  style: "normal",
});

export const cairoLatin = localFont({
  src: "./fonts/cairo-latin-variable.woff2",
  variable: "--font-cairo-latin",
  display: "swap",
  weight: "200 1000",
  style: "normal",
});

export const amiriArabic = localFont({
  src: [
    { path: "./fonts/amiri-arabic-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/amiri-arabic-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-amiri-arabic",
  display: "swap",
  preload: false,
});

export const amiriLatin = localFont({
  src: [
    { path: "./fonts/amiri-latin-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/amiri-latin-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-amiri-latin",
  display: "swap",
  preload: false,
});
