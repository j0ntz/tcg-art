"use client";

import { useMemo } from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";

import { ONBOARDING_STAGES, summarizePipeline } from "@/lib/workday";
import { cn } from "@/lib/utils";
import { cardVariants } from "@/app/components/ui/Card";
import { useOnboarding } from "../../OnboardingProvider";
import { formatDate } from "../../format";
import Avatar from "../../components/Avatar";
import StageTrack from "../../components/StageTrack";
import TaskRow from "../../components/TaskRow";

// New-hire detail: the profile as it would come from Workday, the pipeline
// track, and the task list grouped by stage with owners, due dates, and status
// transitions that persist for the session (via the provider).
const HireDetail: React.FC = () => {
  const params = useParams<{ id: string }>();
  const { getHire } = useOnboarding();
  const record = getHire(params.id);

  const summary = useMemo(
    () => (record != null ? summarizePipeline(record.tasks) : null),
    [record],
  );

  if (record == null || summary == null) {
    notFound();
  }

  const { worker, requisition, tasks } = record;

  const profileFacts: { label: string; value: string }[] = [
    { label: "Employee ID", value: worker.employeeId },
    { label: "Work email", value: worker.primaryWorkEmail },
    { label: "Job profile", value: worker.jobProfile },
    { label: "Worker type", value: worker.workerType },
    { label: "Team", value: worker.supervisoryOrganization },
    { label: "Manager", value: worker.managerName },
    { label: "Location", value: worker.location },
    { label: "Start date", value: formatDate(worker.hireDate) },
    { label: "Requisition", value: `${requisition.requisitionId} · ${requisition.title}` },
  ];

  return (
    <main className="mx-auto w-full max-w-content flex-1 px-gutter py-10 sm:py-12">
      <Link
        href="/onboarding-demo"
        className="inline-flex items-center gap-1.5 text-sm text-foreground-muted transition-colors hover:text-foreground"
      >
        <span aria-hidden>←</span> All hires
      </Link>

      <header className="mt-5 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar name={worker.preferredName} className="h-14 w-14 text-lg" />
          <div>
            <h1 className="font-display text-heading font-bold tracking-tight text-foreground">
              {worker.preferredName}
            </h1>
            <p className="mt-1 text-lead text-foreground-muted">{worker.businessTitle}</p>
            <p className="mt-1 text-sm text-foreground-faint">
              Legal name: {worker.legalName.first} {worker.legalName.last} · WID {worker.workerId}
            </p>
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-xs text-foreground-faint">Onboarding</p>
          <p className="tnum text-lg font-semibold text-foreground">
            {summary.completedTasks}/{summary.totalTasks} tasks
          </p>
          <p className={cn("text-sm", summary.hasBlocker ? "text-danger" : "text-foreground-muted")}>
            {summary.hasBlocker ? "Needs attention" : summary.currentStageLabel}
          </p>
        </div>
      </header>

      <section className="py-8" aria-label="Onboarding pipeline">
        <StageTrack summary={summary} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className={cn(cardVariants(), "h-fit p-5")}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-faint">
            Workday profile
          </h2>
          <dl className="mt-4 flex flex-col gap-3">
            {profileFacts.map((fact) => (
              <div key={fact.label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-foreground-faint">{fact.label}</dt>
                <dd className="text-sm text-foreground-secondary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </aside>

        <section aria-label="Onboarding tasks" className="flex flex-col gap-8">
          {ONBOARDING_STAGES.map((stage) => {
            const stageTasks = tasks.filter((task) => task.stage === stage.stage);
            if (stageTasks.length === 0) return null;
            return (
              <div key={stage.stage}>
                <div className="flex flex-col gap-0.5 border-b border-border pb-2">
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {stage.label}
                  </h3>
                  <p className="text-sm text-foreground-muted">{stage.blurb}</p>
                </div>
                <ul>
                  {stageTasks.map((task) => (
                    <TaskRow key={task.taskId} task={task} />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
};

export default HireDetail;
