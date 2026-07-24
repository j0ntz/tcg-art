import { cn } from "@/lib/utils";
import type { PipelineSummary, StageState } from "@/lib/workday";

// The five-stage onboarding track, shown on the hire detail view. Each stage is
// a labeled node connected by a rail; the node styling encodes its state in
// neutral ink plus the sanctioned success/danger feedback tokens. Left-aligned,
// hairline-driven: the site's ledger voice, not a decorative stepper.
const NODE_CLASSES: Record<StageState, string> = {
  complete: "border-transparent bg-foreground text-background",
  active: "border-border-strong bg-surface text-foreground",
  blocked: "border-danger-border bg-surface text-danger",
  upcoming: "border-border bg-surface-muted text-foreground-faint",
};

const LABEL_CLASSES: Record<StageState, string> = {
  complete: "text-foreground",
  active: "text-foreground font-medium",
  blocked: "text-danger font-medium",
  upcoming: "text-foreground-faint",
};

interface StageTrackProps {
  summary: PipelineSummary;
  className?: string;
}

const StageTrack: React.FC<StageTrackProps> = ({ summary, className }) => (
  <ol className={cn("flex flex-col gap-0 sm:flex-row sm:gap-0", className)}>
    {summary.stages.map((stage, index) => {
      const isLast = index === summary.stages.length - 1;
      return (
        <li key={stage.stage} className="flex flex-1 items-start gap-3 sm:flex-col sm:gap-2">
          {/* Node + rail. On mobile the rail runs vertically; on desktop it runs
              horizontally under the row of nodes. */}
          <div className="flex flex-col items-center sm:w-full sm:flex-row">
            <span
              className={cn(
                "tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-pill border text-xs font-semibold",
                NODE_CLASSES[stage.state],
              )}
            >
              {stage.state === "complete" ? "✓" : index + 1}
            </span>
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "my-1 h-6 w-px sm:my-0 sm:mx-2 sm:h-px sm:w-full",
                  stage.state === "complete" ? "bg-foreground" : "bg-border",
                )}
              />
            ) : null}
          </div>
          <span className={cn("pb-4 text-sm leading-tight sm:pb-0", LABEL_CLASSES[stage.state])}>
            {stage.label}
          </span>
        </li>
      );
    })}
  </ol>
);

export default StageTrack;
