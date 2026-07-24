"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

// Secondary navigation for the demo workspace, sitting under the global site
// header (which already carries the shared theme toggle). Left: the fictional
// company / product wordmark. Center-left: the two demo sections. Right: the
// honesty label that this is simulated Workday data, never a live connection.
const LINKS = [
  { href: "/onboarding-demo", label: "Dashboard" },
  { href: "/onboarding-demo/integration", label: "How the integration works" },
] as const;

const DemoNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="border-b border-border bg-surface-muted">
      <div className="mx-auto flex w-full max-w-content flex-col gap-3 px-gutter py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/onboarding-demo" className="flex items-baseline gap-1.5">
            <span className="font-display text-base font-extrabold tracking-tight text-foreground">
              Northwind
            </span>
            <span className="text-sm text-foreground-muted">People Ops</span>
          </Link>
          <nav className="flex items-center gap-1">
            {LINKS.map((link) => {
              const active =
                link.href === "/onboarding-demo"
                  ? pathname === link.href || pathname.startsWith("/onboarding-demo/hire")
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-pill px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-surface-inverse font-medium text-foreground-on-inverse"
                      : "text-foreground-muted hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-foreground-faint" />
          Simulated Workday data
        </span>
      </div>
    </div>
  );
};

export default DemoNav;
