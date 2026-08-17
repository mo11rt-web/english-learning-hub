/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only use static export for Capacitor/Mobile builds
  output: process.env.CAPACITOR_BUILD === 'true' ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;
