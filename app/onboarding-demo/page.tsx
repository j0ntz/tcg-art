"use client";

import { useMemo } from "react";

import { summarizePipeline } from "@/lib/workday";
import { useOnboarding } from "./OnboardingProvider";
import HireCard from "./components/HireCard";

// Onboarding dashboard: every incoming hire with their pipeline progress.
// Reads from the session provider so a status change on a detail view is
// reflected here on return. Hires with a blocker sort first (attention up top),
// then by soonest start date.
const OnboardingDashboard: React.FC = () => {
  const { records } = useOnboarding();

  const sorted = useMemo(
    () =>
      [...records].sort((a, b) => {
        const aBlocked = summarizePipeline(a.tasks).hasBlocker ? 0 : 1;
        const bBlocked = summarizePipeline(b.tasks).hasBlocker ? 0 : 1;
        if (aBlocked !== bBlocked) return aBlocked - bBlocked;
        return a.worker.hireDate.localeCompare(b.worker.hireDate);
      }),
    [records],
  );

  const attentionCount = useMemo(
    () => records.filter((record) => summarizePipeline(record.tasks).hasBlocker).length,
    [records],
  );

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-gutter py-10 sm:py-12">
      <header className="flex flex-col gap-3 border-b border-border pb-8">
        <h1 className="font-display text-title font-bold tracking-tight text-foreground">
          Incoming hires
        </h1>
        <p className="max-w-2xl text-lead text-foreground-muted">
          {records.length} new {records.length === 1 ? "hire" : "hires"} in onboarding, pulled from
          Workday and tracked through offer, screening, provisioning, day one, and ramp.
          {attentionCount > 0
            ? ` ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention.`
            : ""}
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="mt-10 rounded-panel border border-dashed border-border bg-surface-muted p-10 text-center">
          <p className="font-medium text-foreground">No hires in onboarding</p>
          <p className="mt-1 text-sm text-foreground-muted">
            When a requisition is filled in Workday, the new hire appears here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((record) => (
            <li key={record.worker.workerId}>
              <HireCard record={record} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};

export default OnboardingDashboard;
