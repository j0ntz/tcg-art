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
  // Branch-only behavior for the Workday onboarding demo (issue #62): this
  // branch is a preview host that never merges, so the preview URL should land
  // straight on the demo. On Vercel the deployment's branch is VERCEL_GIT_COMMIT_REF;
  // the redirect fires ONLY when that equals this preview branch, so main and
  // every other branch keep "/" as the normal app. Locally the var is unset, so
  // "/" stays the real site (navigate to /onboarding-demo directly to preview).
  async redirects() {
    const isPreviewBranch = process.env.VERCEL_GIT_COMMIT_REF === "jon/task-62";
    if (!isPreviewBranch) return [];
    return [{ source: "/", destination: "/onboarding-demo", permanent: false }];
  },
};

export default nextConfig;
