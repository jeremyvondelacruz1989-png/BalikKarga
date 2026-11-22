import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    // Forms use server actions, which check the request origin. GitHub Codespaces
    // serves the app through a *.app.github.dev proxy, so allow that host.
    serverActions: { allowedOrigins: ["localhost:3000", "*.app.github.dev"] },
  },
};

export default nextConfig;
