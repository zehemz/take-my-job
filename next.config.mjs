/** @type {import('next').NextConfig} */
const nextConfig = {
  productionBrowserSourceMaps: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  // Skip pre-rendering of error pages; this is a CSR-only in-memory app
  // Workaround for Next.js 14.2.x prerender issue with app-router not-found-boundary
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
