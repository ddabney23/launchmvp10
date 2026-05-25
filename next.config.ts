import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['import-in-the-middle'],
  reactStrictMode: true,
  // TypeScript - temporarily disabled for production build
  // TODO: Fix 419 TypeScript errors (mostly in views and tests)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Suppress Prisma/OpenTelemetry warnings; use in-memory webpack cache on Windows
  // (persistent pack cache can fail with EISDIR/readlink on paths containing spaces)
  webpack: (config, { isServer, dev }) => {
    config.cache = { type: "memory" };
    config.resolve = config.resolve ?? {};
    // Disable symlink resolution to avoid Windows EISDIR/junction errors
    config.resolve.symlinks = false;
    // Force resolve.symlink = false in module rules too
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];
    
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
