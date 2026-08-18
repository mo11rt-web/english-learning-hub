const IS_CAPACITOR_BUILD = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Vercel: يبقى output غير معرّف => بناء SSR/Dynamic طبيعي 100%.
  // Capacitor (NEXT_PUBLIC_CAPACITOR_BUILD=true): تصدير ثابت إلى مجلد out/
  // ليتم تغليفه داخل تطبيق أندرويد عبر Capacitor (webDir: "out").
  output: IS_CAPACITOR_BUILD ? "export" : undefined,

  // التصدير الثابت لا يدعم next/image optimization server-side.
  ...(IS_CAPACITOR_BUILD ? { images: { unoptimized: true } } : {}),
};

module.exports = nextConfig;
