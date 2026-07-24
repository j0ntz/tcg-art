import Link from "next/link";

import { cn } from "@/lib/utils";
import { cardVariants } from "@/app/components/ui/Card";
import { summarizePipeline, type HireRecord } from "@/lib/workday";
import { formatDate } from "../format";
import Avatar from "./Avatar";
import PipelineBar from "./PipelineBar";

// One worker in onboarding on the dashboard grid: identity, requisition facts,
// and the pipeline progress. The whole card is the link target to the detail
// view. Pre-hire records (not yet through the Hire business process) are tagged
// as such.
interface HireCardProps {
  record: HireRecord;
}

const HireCard: React.FC<HireCardProps> = ({ record }) => {
  const { worker } = record;
  const summary = summarizePipeline(record.tasks);

  return (
    <Link
      href={`/onboarding-demo/hire/${worker.workerId}`}
      className={cn(
        cardVariants(),
        "group flex flex-col gap-4 p-5 transition-shadow hover:shadow-card-lifted",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar name={worker.preferredName} className="h-11 w-11 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground group-hover:underline">
            {worker.preferredName}
          </p>
          <p className="truncate text-sm text-foreground-muted">{worker.businessTitle}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {summary.hasBlocker ? (
            <span className="rounded-pill border border-danger-border px-2 py-0.5 text-xs font-medium text-danger">
              Attention
            </span>
          ) : null}
          {worker.isPreHire ? (
            <span className="rounded-pill border border-border px-2 py-0.5 text-xs font-medium text-foreground-muted">
              Pre-hire
            </span>
          ) : null}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex flex-col">
          <dt className="text-xs text-foreground-faint">Team</dt>
          <dd className="truncate text-foreground-secondary">{worker.supervisoryOrganization}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-foreground-faint">Start date</dt>
          <dd className="tnum text-foreground-secondary">{formatDate(worker.hireDate)}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-foreground-faint">Location</dt>
          <dd className="truncate text-foreground-secondary">{worker.location}</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs text-foreground-faint">Manager</dt>
          <dd className="truncate text-foreground-secondary">{worker.managerName}</dd>
        </div>
      </dl>

      <PipelineBar summary={summary} className="mt-1" />
    </Link>
  );
};

export default HireCard;
