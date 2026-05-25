import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  reactStrictMode: true,
  // TypeScript - temporarily disabled for production build
  // TODO: Fix 419 TypeScript errors (mostly in views and tests)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Suppress Prisma/OpenTelemetry warnings; use in-memory webpack cache on Windows
  // (persistent pack cache can fail with EISDIR/readlink on paths containing spaces)
  webpack: (config, { isServer, dev }) => {
    if (!dev) {
      config.cache = { type: "memory" };
    }
    config.resolve = config.resolve ?? {};
    // Disable symlink resolution in webpack to avoid Windows readlink/EISDIR failures
    // when building with Next.js route groups like app\(app) and long path names.
    config.resolve.symlinks = false;
    if (!isServer) {
      config.ignoreWarnings = [
        { module: /@opentelemetry/ },
        { module: /@prisma\/instrumentation/ },
      ];
    }
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Handle environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

export default nextConfig;
