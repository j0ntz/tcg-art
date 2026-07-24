// The Workday integration boundary.
//
// `WorkdayAdapter` is the ONLY surface the UI depends on. The demo binds it to
// `createMockWorkdayAdapter()` (backed by mock-data.ts); a production
// deployment binds it to a live adapter talking to a real tenant. Because the
// UI imports the adapter through `getWorkdayAdapter()` and never touches a data
// source directly, that swap is a one-line change here, with zero UI edits.
//
// The method set mirrors how Workday actually exposes this data:
//   - listOnboardingWorkers ......  a RaaS (Report-as-a-Service) worker report
//   - getWorker / getJobRequisition  Staffing & Recruiting REST GETs
//   - listOnboardingTasks .........  onboarding business-process steps
//   - updateOnboardingTaskStatus ..  a Staffing business-process action (write)

import type {
  HireRecord,
  TaskStatus,
  WorkdayJobRequisition,
  WorkdayOnboardingTask,
  WorkdayWorker,
} from "./types";
import { MOCK_HIRE_RECORDS } from "./mock-data";

export interface WorkdayAdapter {
  // Which data source is behind this adapter. The UI reads this to render the
  // honest "Simulated data" vs "Live tenant" label; it never fakes "live".
  readonly mode: "mock" | "live";

  // RaaS worker report: every worker currently in the onboarding process,
  // with their requisition and task list assembled per record.
  listOnboardingWorkers(): Promise<HireRecord[]>;

  // Staffing GET: a single worker's full record, or null if unknown.
  getHire(workerId: string): Promise<HireRecord | null>;

  // Staffing/Recruiting GETs, exposed individually for parity with the real API.
  getWorker(workerId: string): Promise<WorkdayWorker | null>;
  getJobRequisition(workerId: string): Promise<WorkdayJobRequisition | null>;
  listOnboardingTasks(workerId: string): Promise<WorkdayOnboardingTask[]>;

  // Staffing business-process action (write): advance one onboarding task and
  // return the updated task. A live adapter POSTs this to Workday; the demo
  // mutates its in-memory copy (see the note in the mock below).
  updateOnboardingTaskStatus(
    taskId: string,
    status: TaskStatus,
  ): Promise<WorkdayOnboardingTask>;
}

// --- Mock adapter ---------------------------------------------------------
// Reads from the simulated dataset. It deep-clones on read so callers cannot
// mutate the module-level seed, and keeps writes in a per-instance map. NOTE:
// in a serverless deployment each request may get a fresh instance, so the
// authoritative "session" state for status transitions lives client-side (see
// app/onboarding-demo/OnboardingProvider.tsx). The write method exists to prove
// the adapter interface a real tenant would fill, and to keep a single instance
// consistent within one request.

const cloneRecord = (record: HireRecord): HireRecord => ({
  worker: { ...record.worker, legalName: { ...record.worker.legalName } },
  requisition: { ...record.requisition },
  tasks: record.tasks.map((task) => ({ ...task })),
});

export const createMockWorkdayAdapter = (): WorkdayAdapter => {
  // Per-instance working copy so writes don't leak into the shared seed.
  const records: HireRecord[] = MOCK_HIRE_RECORDS.map(cloneRecord);
  const byId = new Map(records.map((record) => [record.worker.workerId, record]));

  const findTask = (taskId: string): WorkdayOnboardingTask | null => {
    for (const record of records) {
      const task = record.tasks.find((candidate) => candidate.taskId === taskId);
      if (task != null) return task;
    }
    return null;
  };

  return {
    mode: "mock",

    async listOnboardingWorkers() {
      return records.map(cloneRecord);
    },

    async getHire(workerId: string) {
      const record = byId.get(workerId);
      return record != null ? cloneRecord(record) : null;
    },

    async getWorker(workerId: string) {
      const record = byId.get(workerId);
      return record != null ? { ...record.worker, legalName: { ...record.worker.legalName } } : null;
    },

    async getJobRequisition(workerId: string) {
      const record = byId.get(workerId);
      return record != null ? { ...record.requisition } : null;
    },

    async listOnboardingTasks(workerId: string) {
      const record = byId.get(workerId);
      return record != null ? record.tasks.map((task) => ({ ...task })) : [];
    },

    async updateOnboardingTaskStatus(taskId: string, status: TaskStatus) {
      const task = findTask(taskId);
      if (task == null) throw new Error(`Unknown onboarding task: ${taskId}`);
      task.status = status;
      return { ...task };
    },
  };
};

// --- Live adapter (documented stub) ---------------------------------------
// Left intentionally unimplemented: no Workday credentials exist for this demo
// and none should be sought. The interface below is the exact seam a real
// integration fills. To go live, implement each method against the endpoints
// named in the comments, authenticating with OAuth 2.0 client credentials
// (see WorkdayConfig), and point getWorkdayAdapter() at it. The UI does not
// change.

export interface WorkdayConfig {
  // e.g. "https://wd5-impl-services1.workday.com" (the tenant's API host).
  tenantUrl: string;
  // The tenant short name, e.g. "northwind".
  tenant: string;
  // OAuth 2.0 client-credentials pair for an Integration System User (ISU).
  clientId: string;
  clientSecret: string;
  // Optional: the RaaS report path for the onboarding worker report.
  onboardingReportPath?: string;
}

export const createLiveWorkdayAdapter = (_config: WorkdayConfig): WorkdayAdapter => {
  const notImplemented = (endpoint: string): never => {
    throw new Error(
      `Live Workday adapter is not implemented in this demo. Wire ${endpoint} against the tenant, ` +
        "authenticating with OAuth 2.0 client credentials. See the integration page for the map.",
    );
  };

  return {
    mode: "live",
    // GET {tenantUrl}/ccx/service/customreport2/{tenant}/{report} (RaaS)
    listOnboardingWorkers: () => notImplemented("the onboarding RaaS report"),
    // GET {tenantUrl}/ccx/api/staffing/v6/{tenant}/workers/{id}
    getHire: () => notImplemented("Staffing GET workers/{id}"),
    getWorker: () => notImplemented("Staffing GET workers/{id}"),
    // GET {tenantUrl}/ccx/api/recruiting/v5/{tenant}/jobRequisitions?worker={id}
    getJobRequisition: () => notImplemented("Recruiting GET jobRequisitions"),
    // GET {tenantUrl}/ccx/api/staffing/v6/{tenant}/workers/{id}/onboardingTasks
    listOnboardingTasks: () => notImplemented("Staffing GET onboardingTasks"),
    // POST {tenantUrl}/ccx/api/staffing/v6/{tenant}/onboardingTasks/{id}
    updateOnboardingTaskStatus: () => notImplemented("Staffing POST onboardingTasks/{id}"),
  };
};

// --- Factory --------------------------------------------------------------
// The single place the app chooses a data source. When the four required env
// vars are present it would return a live adapter; the demo has none, so it
// returns the mock. Reading the env here (not in the UI) is what keeps the
// "simulated data" boundary honest and swappable.

const readConfig = (): WorkdayConfig | null => {
  const tenantUrl = process.env.WORKDAY_TENANT_URL;
  const tenant = process.env.WORKDAY_TENANT;
  const clientId = process.env.WORKDAY_CLIENT_ID;
  const clientSecret = process.env.WORKDAY_CLIENT_SECRET;
  if (tenantUrl == null || tenant == null || clientId == null || clientSecret == null) {
    return null;
  }
  return {
    tenantUrl,
    tenant,
    clientId,
    clientSecret,
    onboardingReportPath: process.env.WORKDAY_ONBOARDING_REPORT,
  };
};

export const getWorkdayAdapter = (): WorkdayAdapter => {
  const config = readConfig();
  return config != null ? createLiveWorkdayAdapter(config) : createMockWorkdayAdapter();
};
