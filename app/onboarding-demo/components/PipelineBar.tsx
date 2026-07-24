import { cn } from "@/lib/utils";
import type { PipelineSummary } from "@/lib/workday";

// Compact pipeline progress used on dashboard cards: a neutral-ink fill over a
// hairline track, with a tabular task count. The fill turns to the danger token
// only when the hire has a blocker, so an at-risk pipeline reads at a glance
// without spending the ember accent.
interface PipelineBarProps {
  summary: PipelineSummary;
  className?: string;
}

const PipelineBar: React.FC<PipelineBarProps> = ({ summary, className }) => {
  const percent = Math.round(summary.fraction * 100);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-foreground">{summary.currentStageLabel}</span>
        <span className="tnum text-foreground-muted">
          {summary.completedTasks}/{summary.totalTasks}
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Onboarding ${percent}% complete`}
      >
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-500",
            summary.hasBlocker ? "bg-danger" : "bg-foreground",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default PipelineBar;
