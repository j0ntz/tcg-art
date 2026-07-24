// Simulated Workday dataset for the onboarding demo.
//
// This stands in for what a live tenant's Staffing and RaaS endpoints would
// return. It is realistic but entirely fictional: no data here comes from or
// reaches Workday. The mock adapter (adapter.ts) reads exclusively from this
// module, which keeps the "what the data looks like" concern in one file.

import type {
  HireRecord,
  OnboardingStage,
  TaskStatus,
  WorkdayJobRequisition,
  WorkdayOnboardingTask,
  WorkdayWorker,
  WorkerReference,
  WorkerType,
} from "./types";

// --- Date helpers ---------------------------------------------------------
// Due dates are derived from each worker's hire date by a fixed day offset, so
// the dataset stays internally consistent without hand-writing 100+ dates.

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

// --- Task template --------------------------------------------------------
// Every hire runs the same lifecycle: the Hire business process, then the
// Onboarding Setup business process to-dos, then outbound provisioning, then
// day-one readiness. Tasks are generated from one template. `dueOffset` is days
// relative to the hire date (negative = before day one). `owner` is the role the
// business-process step routes to, exactly as Workday routes to-dos.

interface TaskTemplate {
  stage: OnboardingStage;
  name: string;
  owner: string;
  dueOffset: number;
}

// The task at this index marks the Hire business process. Everything before it
// is pre-hire; completing it is what mints the Employee_ID + WID.
const HIRE_TASK_INDEX = 1;

const TASK_TEMPLATES: readonly TaskTemplate[] = [
  { stage: "pre_hire", name: "Offer accepted, pre-hire record created", owner: "HR Partner", dueOffset: -21 },
  { stage: "hire", name: "Hire business process completed (Employee ID + WID minted)", owner: "HR Partner", dueOffset: -14 },
  { stage: "onboarding_setup", name: "Personal information", owner: "Worker", dueOffset: -10 },
  { stage: "onboarding_setup", name: "Federal & state tax withholding", owner: "Worker", dueOffset: -9 },
  { stage: "onboarding_setup", name: "Direct deposit", owner: "Worker", dueOffset: -8 },
  { stage: "onboarding_setup", name: "Emergency contacts", owner: "Worker", dueOffset: -8 },
  { stage: "onboarding_setup", name: "Form I-9 / work authorization", owner: "HR Partner", dueOffset: -6 },
  { stage: "onboarding_setup", name: "Benefits enrollment", owner: "Worker", dueOffset: -4 },
  { stage: "onboarding_setup", name: "Policy acknowledgements", owner: "Worker", dueOffset: -3 },
  { stage: "provisioning", name: "Provision Entra ID / AD account (Hire event, outbound)", owner: "IT", dueOffset: -2 },
  { stage: "provisioning", name: "Hardware & system access", owner: "IT", dueOffset: -1 },
  { stage: "day_one", name: "Manager day-one plan", owner: "Manager", dueOffset: 0 },
] as const;

// A worker's seed record: identity plus how far along the lifecycle they are.
// `completedTasks` marks the first N template steps done; the (N+1)th is
// in_progress; the rest not_started. `blockedTaskIndex`, when set, overrides
// that one step to "blocked" for state variety. A record with fewer than
// HIRE_TASK_INDEX+1 completed steps is still a pre-hire (no WID yet).
interface WorkerSeed {
  worker: Omit<
    WorkdayWorker,
    "workerId" | "wid" | "references" | "isPreHire" | "positionId"
  >;
  requisitionTitle: string;
  hiringManager: string;
  completedTasks: number;
  blockedTaskIndex?: number;
}

const WORKER_SEEDS: readonly WorkerSeed[] = [
  {
    worker: {
      legalName: { first: "Amara", last: "Okafor" },
      preferredName: "Amara Okafor",
      primaryWorkEmail: "amara.okafor@northwind.example",
      businessTitle: "Senior Product Designer",
      jobProfile: "Product Design — P4",
      supervisoryOrganization: "Design Systems",
      managerName: "Priya Nair",
      location: "London, UK",
      hireDate: "2026-08-03",
      workerType: "Employee",
    },
    requisitionTitle: "Senior Product Designer",
    hiringManager: "Priya Nair",
    completedTasks: 12,
  },
  {
    worker: {
      legalName: { first: "Daniel", last: "Ruiz" },
      preferredName: "Dani Ruiz",
      primaryWorkEmail: "daniel.ruiz@northwind.example",
      businessTitle: "Staff Software Engineer",
      jobProfile: "Software Engineering — P5",
      supervisoryOrganization: "Platform Infrastructure",
      managerName: "Marcus Bell",
      location: "Austin, TX",
      hireDate: "2026-08-03",
      workerType: "Employee",
    },
    requisitionTitle: "Staff Software Engineer, Platform",
    hiringManager: "Marcus Bell",
    completedTasks: 7,
  },
  {
    worker: {
      legalName: { first: "Mei", last: "Chen" },
      preferredName: "Mei Chen",
      primaryWorkEmail: "mei.chen@northwind.example",
      businessTitle: "Engineering Manager",
      jobProfile: "Engineering Management — M4",
      supervisoryOrganization: "Payments",
      managerName: "Sofia Almeida",
      location: "Singapore",
      hireDate: "2026-08-10",
      workerType: "Employee",
    },
    requisitionTitle: "Engineering Manager, Payments",
    hiringManager: "Sofia Almeida",
    completedTasks: 5,
  },
  {
    worker: {
      legalName: { first: "Jonah", last: "Weiss" },
      preferredName: "Jonah Weiss",
      primaryWorkEmail: "jonah.weiss@northwind.example",
      businessTitle: "Data Scientist",
      jobProfile: "Data Science — P3",
      supervisoryOrganization: "Growth Analytics",
      managerName: "Ada Okonkwo",
      location: "Remote — US East",
      hireDate: "2026-08-10",
      workerType: "Employee",
    },
    requisitionTitle: "Data Scientist, Growth",
    hiringManager: "Ada Okonkwo",
    completedTasks: 4,
    blockedTaskIndex: 6,
  },
  {
    worker: {
      legalName: { first: "Priyanka", last: "Rao" },
      preferredName: "Priyanka Rao",
      primaryWorkEmail: "priyanka.rao@northwind.example",
      businessTitle: "Product Manager",
      jobProfile: "Product Management — P4",
      supervisoryOrganization: "Merchant Experience",
      managerName: "Tomás Herrera",
      location: "Bengaluru, IN",
      hireDate: "2026-08-17",
      workerType: "Employee",
    },
    requisitionTitle: "Product Manager, Merchant",
    hiringManager: "Tomás Herrera",
    completedTasks: 3,
  },
  {
    worker: {
      legalName: { first: "Kwame", last: "Mensah" },
      preferredName: "Kwame Mensah",
      primaryWorkEmail: "kwame.mensah@northwind.example",
      businessTitle: "Site Reliability Engineer",
      jobProfile: "Software Engineering — P3",
      supervisoryOrganization: "Platform Infrastructure",
      managerName: "Marcus Bell",
      location: "Accra, GH",
      hireDate: "2026-08-17",
      workerType: "Employee",
    },
    requisitionTitle: "Site Reliability Engineer",
    hiringManager: "Marcus Bell",
    completedTasks: 6,
  },
  {
    worker: {
      legalName: { first: " Line ", last: "Sørensen" },
      preferredName: "Line Sørensen",
      primaryWorkEmail: "line.sorensen@northwind.example",
      businessTitle: "UX Researcher",
      jobProfile: "Research — P3",
      supervisoryOrganization: "Design Systems",
      managerName: "Priya Nair",
      location: "Copenhagen, DK",
      hireDate: "2026-08-24",
      workerType: "Employee",
    },
    requisitionTitle: "UX Researcher",
    hiringManager: "Priya Nair",
    completedTasks: 1,
  },
  {
    worker: {
      legalName: { first: "Diego", last: "Fernández" },
      preferredName: "Diego Fernández",
      primaryWorkEmail: "diego.fernandez@northwind.example",
      businessTitle: "Solutions Architect",
      jobProfile: "Sales Engineering — P4",
      supervisoryOrganization: "Field Engineering",
      managerName: "Nadia Haddad",
      location: "Madrid, ES",
      hireDate: "2026-08-24",
      workerType: "Employee",
    },
    requisitionTitle: "Solutions Architect",
    hiringManager: "Nadia Haddad",
    completedTasks: 8,
  },
  {
    worker: {
      legalName: { first: "Grace", last: "Whitfield" },
      preferredName: "Grace Whitfield",
      primaryWorkEmail: "grace.whitfield@northwind.example",
      businessTitle: "Technical Writer",
      jobProfile: "Content — P3",
      supervisoryOrganization: "Developer Relations",
      managerName: "Ravi Suresh",
      location: "Remote — US West",
      hireDate: "2026-08-31",
      workerType: "Contingent Worker",
    },
    requisitionTitle: "Technical Writer (Contingent)",
    hiringManager: "Ravi Suresh",
    completedTasks: 3,
  },
  {
    worker: {
      legalName: { first: "Yusuf", last: "Demir" },
      preferredName: "Yusuf Demir",
      primaryWorkEmail: "yusuf.demir@northwind.example",
      businessTitle: "Security Engineer",
      jobProfile: "Security — P4",
      supervisoryOrganization: "Trust & Safety",
      managerName: "Helena Vogt",
      location: "Berlin, DE",
      hireDate: "2026-08-31",
      workerType: "Employee",
    },
    requisitionTitle: "Security Engineer",
    hiringManager: "Helena Vogt",
    completedTasks: 5,
    blockedTaskIndex: 9,
  },
  {
    worker: {
      legalName: { first: "Aisha", last: "Bello" },
      preferredName: "Aisha Bello",
      primaryWorkEmail: "aisha.bello@northwind.example",
      businessTitle: "Account Executive",
      jobProfile: "Sales — P3",
      supervisoryOrganization: "Enterprise Sales",
      managerName: "Nadia Haddad",
      location: "New York, NY",
      hireDate: "2026-09-07",
      workerType: "Employee",
    },
    requisitionTitle: "Account Executive, Enterprise",
    hiringManager: "Nadia Haddad",
    completedTasks: 1,
  },
  {
    worker: {
      legalName: { first: "Tobias", last: "Lindqvist" },
      preferredName: "Tobias Lindqvist",
      primaryWorkEmail: "tobias.lindqvist@northwind.example",
      businessTitle: "Frontend Engineer",
      jobProfile: "Software Engineering — P3",
      supervisoryOrganization: "Merchant Experience",
      managerName: "Tomás Herrera",
      location: "Stockholm, SE",
      hireDate: "2026-09-07",
      workerType: "Employee",
    },
    requisitionTitle: "Frontend Engineer, Merchant",
    hiringManager: "Tomás Herrera",
    completedTasks: 3,
  },
  {
    worker: {
      legalName: { first: "Rosa", last: "Delgado" },
      preferredName: "Rosa Delgado",
      primaryWorkEmail: "rosa.delgado@northwind.example",
      businessTitle: "People Operations Partner",
      jobProfile: "People — P3",
      supervisoryOrganization: "People Team",
      managerName: "Helena Vogt",
      location: "Mexico City, MX",
      hireDate: "2026-09-14",
      workerType: "Employee",
    },
    requisitionTitle: "People Operations Partner",
    hiringManager: "Helena Vogt",
    completedTasks: 0,
  },
  {
    worker: {
      legalName: { first: "Hassan", last: "Ali" },
      preferredName: "Hassan Ali",
      primaryWorkEmail: "hassan.ali@northwind.example",
      businessTitle: "Machine Learning Engineer",
      jobProfile: "Software Engineering — P4",
      supervisoryOrganization: "Growth Analytics",
      managerName: "Ada Okonkwo",
      location: "Toronto, CA",
      hireDate: "2026-09-14",
      workerType: "Employee",
    },
    requisitionTitle: "Machine Learning Engineer",
    hiringManager: "Ada Okonkwo",
    completedTasks: 6,
  },
] as const;

// --- Identifier minters ----------------------------------------------------
// Deterministic so server and client render the same value (no RNG, which would
// also break SSR hydration). A live tenant's WIDs are likewise stable.

// A 32-hex pseudo-GUID derived from the seed index, matching the shape of a real
// Workday WID. Uses a linear congruential walk seeded by the index.
const widFromIndex = (index: number): string => {
  let state = ((index + 1) * 0x9e3779b1) >>> 0;
  let hex = "";
  while (hex.length < 32) {
    state = (state * 1664525 + 1013904223) >>> 0;
    hex += state.toString(16).padStart(8, "0");
  }
  return hex.slice(0, 32);
};

const buildStatus = (
  index: number,
  completedTasks: number,
  blockedTaskIndex: number | undefined,
): TaskStatus => {
  if (index === blockedTaskIndex) return "blocked";
  if (index < completedTasks) return "complete";
  if (index === completedTasks) return "in_progress";
  return "not_started";
};

// Build the full HireRecord list once at module load. The pre-hire id is the
// stable record key present across the whole lifecycle; the WID + Employee_ID
// (or Contingent_Worker_ID) and position id exist only once the Hire business
// process has completed. `preferredName` / `legalName` are trimmed defensively
// in case a seed carries stray whitespace.
const buildRecord = (seed: WorkerSeed, seedIndex: number): HireRecord => {
  const preHireId = `PRH-${4000 + seedIndex + 1}`;
  const isPreHire = seed.completedTasks <= HIRE_TASK_INDEX;
  const isContingent = seed.worker.workerType === ("Contingent Worker" satisfies WorkerType);

  const references: WorkerReference[] = [{ type: "Pre_Hire_ID", value: preHireId }];
  let wid: string | null = null;
  let positionId: string | null = null;
  if (!isPreHire) {
    wid = widFromIndex(seedIndex);
    positionId = `POS-${21000 + seedIndex + 1}`;
    references.push(
      isContingent
        ? { type: "Contingent_Worker_ID", value: `C-${3000 + seedIndex + 1}` }
        : { type: "Employee_ID", value: String(21000 + seedIndex + 1) },
    );
  }

  const worker: WorkdayWorker = {
    ...seed.worker,
    workerId: preHireId,
    wid,
    references,
    isPreHire,
    positionId,
    preferredName: seed.worker.preferredName.trim(),
    legalName: {
      first: seed.worker.legalName.first.trim(),
      last: seed.worker.legalName.last.trim(),
    },
  };

  const requisition: WorkdayJobRequisition = {
    requisitionId: `R-${2600 + seedIndex + 1}`,
    title: seed.requisitionTitle,
    supervisoryOrganization: seed.worker.supervisoryOrganization,
    hiringManager: seed.hiringManager,
    status: "Filled",
    filledByWorkerId: preHireId,
  };

  const tasks: WorkdayOnboardingTask[] = TASK_TEMPLATES.map((template, taskIndex) => ({
    taskId: `${preHireId}-t${String(taskIndex + 1).padStart(2, "0")}`,
    workerId: preHireId,
    stage: template.stage,
    name: template.name,
    owner: template.owner,
    dueDate: addDays(worker.hireDate, template.dueOffset),
    status: buildStatus(taskIndex, seed.completedTasks, seed.blockedTaskIndex),
  }));

  return { worker, requisition, tasks };
};

export const MOCK_HIRE_RECORDS: readonly HireRecord[] = WORKER_SEEDS.map(buildRecord);
