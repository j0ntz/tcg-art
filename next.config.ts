import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io" },
      // Google account avatars shown on /account.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  // Keep the DB drivers out of the server bundle: pg has optional native
  // bindings and PGlite loads a WASM asset from its package directory.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
