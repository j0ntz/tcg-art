"use client";

import { nextStatus, type WorkdayOnboardingTask } from "@/lib/workday";
import { useOnboarding } from "../OnboardingProvider";
import { formatDate } from "../format";
import StatusPill from "./StatusPill";

// One onboarding task in the detail view: name, owner, due date, current status,
// and a control to advance it. The control cycles the status (not started ->
// in progress -> complete -> not started; blocked -> in progress) and the change
// persists in the session provider. In production this click is where the
// adapter's WRITE call fires: adapter.updateOnboardingTaskStatus(taskId, next).
interface TaskRowProps {
  task: WorkdayOnboardingTask;
}

const ADVANCE_LABEL: Record<WorkdayOnboardingTask["status"], string> = {
  not_started: "Start",
  in_progress: "Mark complete",
  complete: "Reset",
  blocked: "Resolve",
};

const TaskRow: React.FC<TaskRowProps> = ({ task }) => {
  const { setTaskStatus } = useOnboarding();

  return (
    <li className="flex flex-col gap-3 border-b border-border py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{task.name}</p>
        <p className="mt-0.5 text-sm text-foreground-muted">
          {task.owner} · due <span className="tnum">{formatDate(task.dueDate)}</span>
        </p>
      </div>
      <div className="flex items-center gap-3 sm:shrink-0">
        <StatusPill status={task.status} />
        <button
          type="button"
          onClick={() => setTaskStatus(task.workerId, task.taskId, nextStatus(task.status))}
          className="rounded-pill border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-hover"
        >
          {ADVANCE_LABEL[task.status]}
        </button>
      </div>
    </li>
  );
};

export default TaskRow;
