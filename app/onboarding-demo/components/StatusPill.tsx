import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/workday";

// Task-status chip. Uses only semantic tokens: complete reads on the success
// state token, blocked on the danger state token (both are sanctioned data-ink
// feedback states, not decoration), while in_progress and not_started stay in
// neutral ink. No ember is spent here; the accent budget is untouched.
const STATUS_CLASSES: Record<TaskStatus, string> = {
  complete: "border-transparent bg-success-subtle text-foreground",
  in_progress: "border-border-strong bg-surface text-foreground",
  not_started: "border-border bg-surface-muted text-foreground-muted",
  blocked: "border-danger-border bg-surface text-danger",
};

interface StatusPillProps {
  status: TaskStatus;
  className?: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ status, className }) => (
  <span
    className={cn(
      "inline-flex w-fit items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
      STATUS_CLASSES[status],
      className,
    )}
  >
    <span
      aria-hidden
      className={cn(
        "h-1.5 w-1.5 rounded-pill",
        status === "complete" && "bg-foreground",
        status === "in_progress" && "bg-foreground",
        status === "not_started" && "bg-foreground-faint",
        status === "blocked" && "bg-danger",
      )}
    />
    {TASK_STATUS_LABELS[status]}
  </span>
);

export default StatusPill;
