// The Workday integration boundary.
//
// `WorkdayAdapter` is the ONLY surface the UI depends on. The demo binds it to
// `createMockWorkdayAdapter()` (backed by mock-data.ts); a production deployment
// binds it to a live adapter talking to a real tenant. Because the UI imports
// the adapter through `getWorkdayAdapter()` and never touches a data source
// directly, that swap is a one-line change here, with zero UI edits.
//
// The method set mirrors how Workday actually exposes this data:
//   - listOnboardingWorkers ......  a RaaS "Onboarding Status" custom report read
//   - getWorker / getHire .........  Staffing REST GET workers/{wid}
//   - getJobRequisition ...........  Recruiting REST GET jobRequisitions/{id}
//   - listOnboardingTasks .........  the RaaS report filtered to one worker
//   - updateOnboardingTaskStatus ..  a DEMO-LOCAL session write (see note below)

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

  // RaaS Onboarding Status report: every worker and pre-hire currently in the
  // onboarding process, with their requisition and task list assembled per
  // record. Workday is the system of record; this is an outbound READ.
  listOnboardingWorkers(): Promise<HireRecord[]>;

  // A single record's full detail, or null if unknown. Keyed on the stable
  // record id (the pre-hire id, present across the whole lifecycle).
  getHire(recordId: string): Promise<HireRecord | null>;

  // Staffing / Recruiting / RaaS reads, exposed individually for parity with
  // the real API surface.
  getWorker(recordId: string): Promise<WorkdayWorker | null>;
  getJobRequisition(recordId: string): Promise<WorkdayJobRequisition | null>;
  listOnboardingTasks(recordId: string): Promise<WorkdayOnboardingTask[]>;

  // DEMO-LOCAL session write. Workday is the system of record for onboarding
  // status: task state originates INSIDE Workday and flows outbound, so a real
  // external app does not write it back. This method advances the demo's own
  // in-memory copy to keep the console interactive; nothing is sent to a tenant.
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
// app/onboarding-demo/OnboardingProvider.tsx). The write method exists only to
// keep a single instance consistent within one request; it is not a Workday
// write (see the interface note above).

const cloneRecord = (record: HireRecord): HireRecord => ({
  worker: {
    ...record.worker,
    legalName: { ...record.worker.legalName },
    references: record.worker.references.map((reference) => ({ ...reference })),
  },
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

    async getHire(recordId: string) {
      const record = byId.get(recordId);
      return record != null ? cloneRecord(record) : null;
    },

    async getWorker(recordId: string) {
      const record = byId.get(recordId);
      if (record == null) return null;
      return {
        ...record.worker,
        legalName: { ...record.worker.legalName },
        references: record.worker.references.map((reference) => ({ ...reference })),
      };
    },

    async getJobRequisition(recordId: string) {
      const record = byId.get(recordId);
      return record != null ? { ...record.requisition } : null;
    },

    async listOnboardingTasks(recordId: string) {
      const record = byId.get(recordId);
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
// named in the comments, authenticating with OAuth 2.0 (see WorkdayConfig): the
// ISU-bound refresh token is exchanged for a ~1h access token at the tenant's
// ccx/oauth2/{tenant}/token endpoint, then sent as a Bearer token. Point
// getWorkdayAdapter() at it and the UI does not change.

export interface WorkdayConfig {
  // The tenant's API host, e.g. "https://wd5-impl-services1.workday.com".
  tenantHost: string;
  // The tenant short name, used in every path, e.g. "northwind".
  tenant: string;
  // OAuth 2.0 API Client for Integrations, registered in the tenant.
  clientId: string;
  clientSecret: string;
  // The refresh token bound to the Integration System User (ISU); exchanged for
  // short-lived access tokens at ccx/oauth2/{tenant}/token.
  refreshToken: string;
}

export const createLiveWorkdayAdapter = (_config: WorkdayConfig): WorkdayAdapter => {
  const notImplemented = (endpoint: string): never => {
    throw new Error(
      `Live Workday adapter is not implemented in this demo. Wire ${endpoint} against the tenant, ` +
        "exchanging the ISU refresh token for an access token at ccx/oauth2/{tenant}/token. " +
        "See the integration page for the map.",
    );
  };

  return {
    mode: "live",
    // GET {tenantHost}/ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?format=json (RaaS)
    listOnboardingWorkers: () => notImplemented("the Onboarding Status RaaS report"),
    // GET {tenantHost}/ccx/api/staffing/v6/{tenant}/workers/{wid}
    getHire: () => notImplemented("Staffing GET workers/{wid}"),
    // GET {tenantHost}/ccx/api/staffing/v6/{tenant}/workers/{wid}
    getWorker: () => notImplemented("Staffing GET workers/{wid}"),
    // GET {tenantHost}/ccx/api/recruiting/v4/{tenant}/jobRequisitions/{id}
    getJobRequisition: () => notImplemented("Recruiting GET jobRequisitions/{id}"),
    // GET {tenantHost}/ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?Worker!WID={wid}&format=json (RaaS)
    listOnboardingTasks: () => notImplemented("the Onboarding Status RaaS report, filtered by worker"),
    // No live write: Workday is the system of record for onboarding status.
    updateOnboardingTaskStatus: () =>
      notImplemented("nothing — onboarding status is read from Workday, not written to it"),
  };
};

// --- Factory --------------------------------------------------------------
// The single place the app chooses a data source. When the full set of env vars
// is present it would return a live adapter; the demo has none, so it returns
// the mock. Reading the env here (not in the UI) is what keeps the "simulated
// data" boundary honest and swappable.

const readConfig = (): WorkdayConfig | null => {
  const tenantHost = process.env.WORKDAY_TENANT_HOST;
  const tenant = process.env.WORKDAY_TENANT;
  const clientId = process.env.WORKDAY_CLIENT_ID;
  const clientSecret = process.env.WORKDAY_CLIENT_SECRET;
  const refreshToken = process.env.WORKDAY_REFRESH_TOKEN;
  if (
    tenantHost == null ||
    tenant == null ||
    clientId == null ||
    clientSecret == null ||
    refreshToken == null
  ) {
    return null;
  }
  return { tenantHost, tenant, clientId, clientSecret, refreshToken };
};

export const getWorkdayAdapter = (): WorkdayAdapter => {
  const config = readConfig();
  return config != null ? createLiveWorkdayAdapter(config) : createMockWorkdayAdapter();
};
