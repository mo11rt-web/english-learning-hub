/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_PUBLIC_CAPACITOR_BUILD === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;
