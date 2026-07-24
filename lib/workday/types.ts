// Workday-shaped domain types for the onboarding demo.
//
// These interfaces mirror the shapes a real Workday tenant exposes through its
// REST Staffing endpoints and RaaS (Report-as-a-Service) reads, so that swapping
// the mock adapter for a live one (see adapter.ts) is a data-source change, not
// a UI rewrite. The vocabulary is Workday's own: a person is a WORKER (subtype
// Employee or Contingent Worker), a role is a "businessTitle", a team is a
// "supervisoryOrganization", and each worker carries a WID plus typed reference
// IDs. Nothing here claims a live connection; the values are simulated (see
// mock-data.ts).

// The onboarding lifecycle, in order. It follows Workday's real staffing model:
// a person starts as a PRE-HIRE record, the HIRE business process converts them
// to a worker (minting the Employee_ID + WID and assigning a position), then the
// Onboarding Setup business process drives the new-hire task list, provisioning
// is triggered OUTBOUND from the Hire event, and the worker is ready for day one.
export type OnboardingStage =
  | "pre_hire"
  | "hire"
  | "onboarding_setup"
  | "provisioning"
  | "day_one";

export const ONBOARDING_STAGES: readonly {
  stage: OnboardingStage;
  label: string;
  // One-line description of what the stage covers, shown on the detail view.
  blurb: string;
}[] = [
  {
    stage: "pre_hire",
    label: "Pre-hire",
    blurb: "Offer accepted; a pre-hire record exists in Recruiting, not yet a worker.",
  },
  {
    stage: "hire",
    label: "Hire",
    blurb: "The Hire business process completes: a position is filled and the Employee ID + WID are minted.",
  },
  {
    stage: "onboarding_setup",
    label: "Onboarding Setup",
    blurb: "Onboarding Setup business-process to-dos, routed to the worker, Manager, and HR Partner.",
  },
  {
    stage: "provisioning",
    label: "Provisioning",
    blurb: "The Hire event triggers outbound account creation (Entra ID / AD) and payroll setup.",
  },
  {
    stage: "day_one",
    label: "Ready for day one",
    blurb: "Final readiness checks before the worker's start date.",
  },
] as const;

// Task lifecycle status. Mirrors the states a Workday business-process step can
// be in; "blocked" surfaces an exception (e.g. an I-9 that came back needing
// review) so the demo can show a non-happy-path state.
export type TaskStatus = "not_started" | "in_progress" | "complete" | "blocked";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
  blocked: "Blocked",
};

// Worker subtypes as Workday models them. "Contingent Worker" (never
// "Contractor" or a bare "Contingent") is the exact term the product uses.
export type WorkerType = "Employee" | "Contingent Worker";

// A typed reference ID. Workday never keys on bare integers: every identifier
// carries its type (Pre_Hire_ID before hire, Employee_ID / Contingent_Worker_ID
// after) so integrations resolve the right one.
export interface WorkerReference {
  type: "Pre_Hire_ID" | "Employee_ID" | "Contingent_Worker_ID";
  value: string;
}

// A Worker as the onboarding demo consumes it. Before the Hire business process
// completes the record is a pre-hire: `wid` and `positionId` are null and the
// only reference ID is the Pre_Hire_ID. The Hire event is what mints the WID +
// Employee_ID and assigns the position, so those fields appearing IS the signal
// that the person became a worker.
export interface WorkdayWorker {
  // Stable record key used for routing and lookups across the whole lifecycle.
  // The pre-hire id is the one identifier present from pre-hire through worker,
  // so the demo keys on it; a live app would switch to the WID once hired.
  workerId: string;
  // Workday ID (WID): the 32-hex, tenant-unique GUID minted by the Hire BP.
  // Null while the record is still a pre-hire.
  wid: string | null;
  // Typed reference IDs. Always includes the Pre_Hire_ID; gains the
  // Employee_ID or Contingent_Worker_ID once the Hire BP completes.
  references: WorkerReference[];
  workerType: WorkerType;
  // True until the Hire business process completes.
  isPreHire: boolean;
  legalName: { first: string; last: string };
  preferredName: string;
  primaryWorkEmail: string;
  // "Business Title" is the role; "Job Profile" is the leveled catalog entry.
  businessTitle: string;
  jobProfile: string;
  // The position the Hire BP fills. Null until hired.
  positionId: string | null;
  // The team, as Workday models it: a supervisory organization plus its manager.
  supervisoryOrganization: string;
  managerName: string;
  location: string;
  // ISO date (YYYY-MM-DD); the effective hire / start date.
  hireDate: string;
}

// A Job Requisition (Recruiting), the opening the worker was hired against.
export interface WorkdayJobRequisition {
  requisitionId: string;
  title: string;
  supervisoryOrganization: string;
  hiringManager: string;
  status: "Filled" | "Open";
  // The worker who filled it (stable record key).
  filledByWorkerId: string;
}

// A single onboarding task: one Onboarding Setup business-process step Workday
// tracks for a worker, with the role it is routed to and a due date.
export interface WorkdayOnboardingTask {
  taskId: string;
  workerId: string;
  stage: OnboardingStage;
  name: string;
  // The role the business-process step is routed to (Worker, Manager, HR
  // Partner, IT), as Workday routes to-dos.
  owner: string;
  // ISO date the step is due.
  dueDate: string;
  status: TaskStatus;
}

// The composite a UI screen consumes: everything the demo needs about one
// worker. A live adapter assembles this from separate Staffing and RaaS calls;
// the type is the contract the UI depends on, not any single endpoint.
export interface HireRecord {
  worker: WorkdayWorker;
  requisition: WorkdayJobRequisition;
  tasks: WorkdayOnboardingTask[];
}

// --- Wire shapes ----------------------------------------------------------
// What a real tenant actually returns on the network. The mock adapter maps
// these to the clean domain types above; the integration page renders samples
// of them so a viewer sees Workday's true envelopes. Kept exported so the live
// adapter (adapter.ts) and the explainer share one definition.

// The reference envelope Workday REST wraps every object in: a WID id, a human
// descriptor, and an href to the resource. Nested references use the same shape.
export interface ReferenceEnvelope {
  id: string;
  descriptor: string;
  href: string;
}

// A worker row from the Staffing REST collection:
// GET ccx/api/staffing/v6/{tenant}/workers?limit={n}&offset={n}
export interface StaffingWorker {
  id: string;
  descriptor: string;
  href: string;
  primaryWorkEmail: string;
  workerType: ReferenceEnvelope;
  primaryJob: {
    positionId: string;
    businessTitle: string;
    supervisoryOrganization: ReferenceEnvelope;
    manager: ReferenceEnvelope;
  };
  // Typed reference IDs, never bare ints.
  referenceIds: { type: string; value: string }[];
}

// The Staffing workers collection response (limit/offset pagination).
export interface StaffingWorkersResponse {
  total: number;
  data: StaffingWorker[];
}

// One row of the RaaS "Onboarding Status" custom report:
// GET ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?format=json
// The report exposes each worker/task pairing as a flat entry.
export interface OnboardingStatusEntry {
  Worker: string;
  WID: string;
  Employee_ID: string;
  Supervisory_Organization: string;
  Onboarding_Task: string;
  Task_Status: string;
  Owner_Role: string;
  Due_Date: string;
}

// RaaS wraps every custom-report response in a top-level `Report_Entry` array;
// the JSON format has no native pagination.
export interface OnboardingStatusReport {
  Report_Entry: OnboardingStatusEntry[];
}
