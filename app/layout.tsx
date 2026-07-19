import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";
import SiteFooter from "./components/SiteFooter";

// The two-family type system (docs/design-system.md): Bricolage Grotesque
// carries display headings (variable weight, used at its extremes for
// contrast), IBM Plex Sans carries everything else. Both self-hosted via
// next/font; no third family may be added, and no serif may ever return.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL != null ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TCG-Art — Find Pokémon Cards by What's In the Art",
    template: "%s — TCG-Art",
  },
  description:
    "Search 20,000+ Pokémon TCG cards by what their art shows. Describe a scene, a mood, or a color and find the card.",
  openGraph: {
    siteName: "TCG-Art",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "TCG-Art — search cards by their art" }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
