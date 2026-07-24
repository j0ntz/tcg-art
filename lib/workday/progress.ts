// Pure derivations over a hire's onboarding tasks. Kept framework-free so both
// the server dashboard and the client detail view compute progress identically.

import { ONBOARDING_STAGES, type OnboardingStage, type TaskStatus, type WorkdayOnboardingTask } from "./types";

// How a stage reads at a glance in the pipeline visualization.
export type StageState = "complete" | "active" | "blocked" | "upcoming";

const stageTasks = (
  tasks: readonly WorkdayOnboardingTask[],
  stage: OnboardingStage,
): WorkdayOnboardingTask[] => tasks.filter((task) => task.stage === stage);

// A stage is blocked if any of its tasks is blocked; complete only if all are
// complete; active if it has started but not finished; otherwise upcoming.
export const stageState = (
  tasks: readonly WorkdayOnboardingTask[],
  stage: OnboardingStage,
): StageState => {
  const group = stageTasks(tasks, stage);
  if (group.length === 0) return "upcoming";
  if (group.some((task) => task.status === "blocked")) return "blocked";
  if (group.every((task) => task.status === "complete")) return "complete";
  if (group.some((task) => task.status !== "not_started")) return "active";
  return "upcoming";
};

export interface PipelineSummary {
  // Completed tasks over total, as a 0-1 fraction (for the progress bar width).
  fraction: number;
  completedTasks: number;
  totalTasks: number;
  // Per-stage state in canonical stage order.
  stages: { stage: OnboardingStage; label: string; state: StageState }[];
  // True when any task is blocked; drives the "needs attention" surface.
  hasBlocker: boolean;
  // The label of the stage currently in flight, or "Complete" when done.
  currentStageLabel: string;
}

export const summarizePipeline = (tasks: readonly WorkdayOnboardingTask[]): PipelineSummary => {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "complete").length;
  const stages = ONBOARDING_STAGES.map((stage) => ({
    stage: stage.stage,
    label: stage.label,
    state: stageState(tasks, stage.stage),
  }));
  const active = stages.find((stage) => stage.state === "active" || stage.state === "blocked");
  return {
    fraction: totalTasks === 0 ? 0 : completedTasks / totalTasks,
    completedTasks,
    totalTasks,
    stages,
    hasBlocker: tasks.some((task) => task.status === "blocked"),
    currentStageLabel: active != null ? active.label : "Complete",
  };
};

const STATUS_ORDER: Record<TaskStatus, TaskStatus> = {
  not_started: "in_progress",
  in_progress: "complete",
  complete: "not_started",
  blocked: "in_progress",
};

// The next status when a user clicks to advance a task. Blocked resolves to
// in_progress; complete cycles back to not_started so the demo is replayable.
export const nextStatus = (status: TaskStatus): TaskStatus => STATUS_ORDER[status];
