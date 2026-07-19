import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the floating dev-tools badge out of the vision-loop screenshots.
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io" },
      // Newer sets' card images are served from scrydex (the API's CDN).
      { protocol: "https", hostname: "images.scrydex.com" },
      // Google account avatars shown on /account.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  // Keep the DB drivers out of the server bundle: pg has optional native
  // bindings and PGlite loads a WASM asset from its package directory.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  async redirects() {
    return [
      // The binder retired in favor of saves + decks; old links land on saves.
      { source: "/binder", destination: "/saves", permanent: true },
    ];
  },
};

export default nextConfig;
