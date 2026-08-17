/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We remove output: export to allow Vercel to work normally
  // and use a custom script for Capacitor if needed.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;
