import type { Metadata } from "next";

import { getWorkdayAdapter } from "@/lib/workday";
import DemoNav from "./components/DemoNav";
import OnboardingProvider from "./OnboardingProvider";

export const metadata: Metadata = {
  title: "Onboarding — Workday Integration Demo",
  description:
    "A demonstration onboarding console backed by a simulated Workday integration. Not a live connection.",
};

// The demo route group. The adapter is resolved once on the server (mock unless
// a full set of Workday env vars is present) and its RaaS worker read seeds the
// client provider, so status transitions the user makes persist across
// dashboard <-> detail navigation for the session. Everything below the global
// site header is demo-scoped; the existing app routes are untouched.
export default async function OnboardingDemoLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const adapter = getWorkdayAdapter();
  const records = await adapter.listOnboardingWorkers();

  return (
    <OnboardingProvider initialRecords={records} mode={adapter.mode}>
      <div className="flex flex-1 flex-col">
        <DemoNav />
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-border px-gutter py-6">
          <p className="mx-auto w-full max-w-content text-xs leading-relaxed text-foreground-faint">
            Demonstration only. All people, teams, and onboarding records shown are fictional and
            generated for this demo; the data is served by a simulated Workday adapter and is not a
            live Workday connection. See “How the integration works” for the adapter boundary a real
            tenant would fill.
          </p>
        </footer>
      </div>
    </OnboardingProvider>
  );
}
