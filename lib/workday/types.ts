// Workday-shaped domain types for the onboarding demo.
//
// These interfaces deliberately mirror the shapes a real Workday tenant returns
// from its REST Staffing/HCM endpoints and RaaS (Report-as-a-Service) reads, so
// that swapping the mock adapter for a live one (see adapter.ts) is a
// data-source change, not a UI rewrite. Field names follow Workday's own
// vocabulary: a person is a "Worker" with a WID (Workday ID), a role is a
// "businessTitle", a team is a "supervisoryOrganization", and onboarding steps
// are business-process tasks. Nothing here claims a live connection; the values
// are simulated (see mock-data.ts).

// The five onboarding pipeline stages, in order. A worker moves left to right;
// the dashboard visualizes how far each hire has progressed.
export type OnboardingStage =
  | "offer"
  | "background_check"
  | "provisioning"
  | "day_one"
  | "ramp";

export const ONBOARDING_STAGES: readonly {
  stage: OnboardingStage;
  label: string;
  // One-line description of what the stage covers, shown on the detail view.
  blurb: string;
}[] = [
  { stage: "offer", label: "Offer accepted", blurb: "Signed offer received and countersigned." },
  {
    stage: "background_check",
    label: "Background check",
    blurb: "Identity, right-to-work, and screening clearance.",
  },
  {
    stage: "provisioning",
    label: "Equipment & provisioning",
    blurb: "Hardware shipped and system access granted.",
  },
  {
    stage: "day_one",
    label: "Day-one checklist",
    blurb: "Orientation, workspace, and first-day logistics.",
  },
  { stage: "ramp", label: "Ramp milestones", blurb: "Goal-setting and the first ramp checkpoints." },
] as const;

// Task lifecycle status. Mirrors the states a Workday business-process step can
// be in; "blocked" surfaces an exception (e.g. a screening that came back
// needing review) so the demo can show a non-happy-path state.
export type TaskStatus = "not_started" | "in_progress" | "complete" | "blocked";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  blocked: "Blocked",
};

// A Worker as returned by a Staffing GET or a RaaS worker report. The shape is
// intentionally close to Workday's: descriptors carry both a human name and the
// stable WID a real integration keys on.
export interface WorkdayWorker {
  // Workday ID (WID): the stable GUID a live tenant returns. The mock uses a
  // readable pseudo-GUID; a real adapter passes Workday's through unchanged.
  workerId: string;
  // The human-facing employee number (Staffing "Employee ID").
  employeeId: string;
  legalName: { first: string; last: string };
  preferredName: string;
  primaryWorkEmail: string;
  // "Business Title" is the role; "Job Profile" is the leveled catalog entry.
  businessTitle: string;
  jobProfile: string;
  // The team, as Workday models it: a supervisory organization plus its manager.
  supervisoryOrganization: string;
  managerName: string;
  location: string;
  // ISO date (YYYY-MM-DD); Workday returns the effective hire date here.
  hireDate: string;
  workerType: "Employee" | "Contingent";
}

// A Job Requisition (Recruiting), the opening a worker was hired against.
export interface WorkdayJobRequisition {
  requisitionId: string;
  title: string;
  supervisoryOrganization: string;
  hiringManager: string;
  status: "Filled" | "Open";
  // The worker who filled it (WID).
  filledByWorkerId: string;
}

// A single onboarding task: one business-process step Workday tracks for a
// worker, with a responsible owner and a due date.
export interface WorkdayOnboardingTask {
  taskId: string;
  workerId: string;
  stage: OnboardingStage;
  name: string;
  // The responsible party, as a role or named owner (e.g. "IT — Provisioning").
  owner: string;
  // ISO date the step is due.
  dueDate: string;
  status: TaskStatus;
}

// The composite a UI screen consumes: everything the demo needs about one hire.
// A live adapter assembles this from separate Staffing/Recruiting/RaaS calls;
// the type is the contract the UI depends on, not any single endpoint.
export interface HireRecord {
  worker: WorkdayWorker;
  requisition: WorkdayJobRequisition;
  tasks: WorkdayOnboardingTask[];
}
