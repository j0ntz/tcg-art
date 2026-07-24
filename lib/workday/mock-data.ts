// Simulated Workday dataset for the onboarding demo.
//
// This stands in for what a live tenant's Staffing/Recruiting/RaaS endpoints
// would return. It is realistic but entirely fictional: no data here comes from
// or reaches Workday. The mock adapter (adapter.ts) reads exclusively from this
// module, which keeps the "what the data looks like" concern in one file.

import type {
  HireRecord,
  OnboardingStage,
  TaskStatus,
  WorkdayJobRequisition,
  WorkdayOnboardingTask,
  WorkdayWorker,
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
// Every hire runs the same onboarding business process, so the tasks are
// generated from one template. `dueOffset` is days relative to the hire date
// (negative = before day one, the norm for provisioning and screening).

interface TaskTemplate {
  stage: OnboardingStage;
  name: string;
  owner: string;
  dueOffset: number;
}

const TASK_TEMPLATES: readonly TaskTemplate[] = [
  { stage: "offer", name: "Signed offer letter received", owner: "Recruiting", dueOffset: -21 },
  { stage: "background_check", name: "Identity & right-to-work (I-9)", owner: "People Ops", dueOffset: -10 },
  { stage: "background_check", name: "Background screening (Sterling)", owner: "People Ops", dueOffset: -7 },
  { stage: "provisioning", name: "Laptop & peripherals shipped", owner: "IT — Provisioning", dueOffset: -4 },
  { stage: "provisioning", name: "Accounts & access provisioned", owner: "IT — Identity", dueOffset: -2 },
  { stage: "day_one", name: "Day-one orientation scheduled", owner: "People Ops", dueOffset: 0 },
  { stage: "day_one", name: "Workspace & badge ready", owner: "Facilities", dueOffset: 0 },
  { stage: "ramp", name: "30-day goals set with manager", owner: "Hiring Manager", dueOffset: 14 },
  { stage: "ramp", name: "Team intro & onboarding buddy assigned", owner: "Hiring Manager", dueOffset: 5 },
] as const;

// A worker's seed record: identity plus how far along the pipeline they are.
// `completedTasks` marks the first N template steps done; the (N+1)th is
// in_progress; the rest not_started. `blockedTaskIndex`, when set, overrides
// that one step to "blocked" for state variety.
interface WorkerSeed {
  worker: Omit<WorkdayWorker, "workerId" | "employeeId">;
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
    completedTasks: 9,
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
    completedTasks: 6,
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
    completedTasks: 4,
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
    completedTasks: 3,
    blockedTaskIndex: 2,
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
    completedTasks: 2,
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
    completedTasks: 5,
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
    completedTasks: 7,
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
      workerType: "Contingent",
    },
    requisitionTitle: "Technical Writer (Contract)",
    hiringManager: "Ravi Suresh",
    completedTasks: 2,
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
    completedTasks: 4,
    blockedTaskIndex: 4,
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

// Build the full HireRecord list once at module load. IDs are derived from the
// index so they are stable across reads (a live tenant's WIDs are likewise
// stable). `preferredName` is trimmed defensively in case a seed carries stray
// whitespace.
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

const buildRecord = (seed: WorkerSeed, seedIndex: number): HireRecord => {
  const workerId = `wid-${String(seedIndex + 1).padStart(4, "0")}-northwind`;
  const employeeId = `E-${10400 + seedIndex + 1}`;
  const worker: WorkdayWorker = {
    ...seed.worker,
    workerId,
    employeeId,
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
    filledByWorkerId: workerId,
  };

  const tasks: WorkdayOnboardingTask[] = TASK_TEMPLATES.map((template, taskIndex) => ({
    taskId: `${workerId}-t${String(taskIndex + 1).padStart(2, "0")}`,
    workerId,
    stage: template.stage,
    name: template.name,
    owner: template.owner,
    dueDate: addDays(worker.hireDate, template.dueOffset),
    status: buildStatus(taskIndex, seed.completedTasks, seed.blockedTaskIndex),
  }));

  return { worker, requisition, tasks };
};

export const MOCK_HIRE_RECORDS: readonly HireRecord[] = WORKER_SEEDS.map(buildRecord);
