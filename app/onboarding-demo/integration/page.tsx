import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { cardVariants } from "@/app/components/ui/Card";

export const metadata: Metadata = {
  title: "How the integration works — Workday Demo",
  description:
    "The adapter boundary, the OAuth 2.0 / ISU auth story, the real Workday endpoint shapes, and the outbound Hire-event provisioning a live tenant drives.",
};

// Static explainer for the integration story: the architecture, the adapter
// interface the UI depends on, the OAuth 2.0 auth story, the real Workday
// endpoint shapes each method maps to, the outbound Hire-event provisioning, and
// the env vars a live tenant needs. Server-rendered; no data source touched.

const ENV_VARS: { name: string; example: string; note: string }[] = [
  {
    name: "WORKDAY_TENANT_HOST",
    example: "https://wd5-impl-services1.workday.com",
    note: "The tenant's API host.",
  },
  { name: "WORKDAY_TENANT", example: "northwind", note: "Tenant short name, used in every path." },
  {
    name: "WORKDAY_CLIENT_ID",
    example: "MTIz…",
    note: "OAuth 2.0 client ID from Register API Client for Integrations.",
  },
  {
    name: "WORKDAY_CLIENT_SECRET",
    example: "••••••••",
    note: "OAuth 2.0 client secret paired with the client ID.",
  },
  {
    name: "WORKDAY_REFRESH_TOKEN",
    example: "••••••••",
    note: "Refresh token bound to the Integration System User (ISU), often non-expiring.",
  },
];

const ENDPOINTS: { method: string; call: string; endpoint: string }[] = [
  {
    method: "GET",
    call: "listOnboardingWorkers()",
    endpoint: "/ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?format=json  (RaaS)",
  },
  {
    method: "GET",
    call: "(worker list, paged)",
    endpoint: "/ccx/api/staffing/v6/{tenant}/workers?limit=100&offset=0",
  },
  {
    method: "GET",
    call: "getWorker(id) / getHire(id)",
    endpoint: "/ccx/api/staffing/v6/{tenant}/workers/{wid}",
  },
  {
    method: "GET",
    call: "getJobRequisition(id)",
    endpoint: "/ccx/api/recruiting/v4/{tenant}/jobRequisitions/{id}",
  },
  {
    method: "GET",
    call: "listOnboardingTasks(id)",
    endpoint: "/ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?Worker!WID={wid}&format=json",
  },
  {
    method: "—",
    call: "updateOnboardingTaskStatus(id, status)",
    endpoint: "demo-local session only — Workday is the system of record for status",
  },
];

const ADAPTER_INTERFACE = `export interface WorkdayAdapter {
  readonly mode: "mock" | "live";

  // RaaS Onboarding Status report -> every worker + pre-hire
  listOnboardingWorkers(): Promise<HireRecord[]>;

  // Staffing / Recruiting / RaaS reads (Workday is system of record)
  getHire(recordId: string): Promise<HireRecord | null>;
  getWorker(recordId: string): Promise<WorkdayWorker | null>;
  getJobRequisition(recordId: string): Promise<WorkdayJobRequisition | null>;
  listOnboardingTasks(recordId: string): Promise<WorkdayOnboardingTask[]>;

  // Demo-local session write (never sent to a tenant)
  updateOnboardingTaskStatus(
    taskId: string,
    status: TaskStatus,
  ): Promise<WorkdayOnboardingTask>;
}`;

// Sample of the OAuth 2.0 token exchange a live integration runs first: the
// ISU-bound refresh token is traded for a ~1h Bearer access token.
const TOKEN_SAMPLE = `POST https://{host}/ccx/oauth2/{tenant}/token
Authorization: Basic base64(WORKDAY_CLIENT_ID:WORKDAY_CLIENT_SECRET)
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={WORKDAY_REFRESH_TOKEN}

-> { "access_token": "eyJ…", "token_type": "Bearer", "expires_in": 3600 }`;

// Sample of the real Staffing REST worker envelope: a WID id, a human
// descriptor, an href, and nested references in the same {id, descriptor, href}
// shape. Typed reference IDs, never bare ints.
const STAFFING_SAMPLE = `GET /ccx/api/staffing/v6/northwind/workers/{wid}

{
  "id": "9f2c1a7b6e4d8c3f0a5b2e9d7c4f1a6b",
  "descriptor": "Amara Okafor (21001)",
  "href": "https://{host}/ccx/api/staffing/v6/northwind/workers/9f2c…",
  "primaryWorkEmail": "amara.okafor@northwind.example",
  "workerType": { "id": "d3…", "descriptor": "Employee" },
  "primaryJob": {
    "positionId": "POS-21001",
    "businessTitle": "Senior Product Designer",
    "supervisoryOrganization": {
      "id": "51…", "descriptor": "Design Systems", "href": "…"
    },
    "manager": { "id": "77…", "descriptor": "Priya Nair", "href": "…" }
  },
  "referenceIds": [{ "type": "Employee_ID", "value": "21001" }]
}`;

// Sample of the RaaS custom report: a top-level Report_Entry array, one row per
// worker/task pairing. This is how an external app reads onboarding status.
const RAAS_SAMPLE = `GET /ccx/service/customreport2/northwind/isu_integrations/Onboarding_Status?format=json

{
  "Report_Entry": [
    {
      "Worker": "Amara Okafor",
      "WID": "9f2c1a7b6e4d8c3f0a5b2e9d7c4f1a6b",
      "Employee_ID": "21001",
      "Supervisory_Organization": "Design Systems",
      "Onboarding_Task": "Direct deposit",
      "Task_Status": "In Progress",
      "Owner_Role": "Worker",
      "Due_Date": "2026-07-26"
    }
  ]
}`;

// A labeled box in a diagram. currentColor + CSS-var fills keep it theme-aware
// in both light and dark with no duplicated markup.
const DiagramBox: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  emphasis?: boolean;
}> = ({ x, y, w, h, title, subtitle, emphasis }) => (
  <g>
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={12}
      fill="var(--color-surface)"
      stroke={emphasis ? "var(--color-border-strong)" : "var(--color-border)"}
      strokeWidth={emphasis ? 2 : 1}
    />
    <text
      x={x + w / 2}
      y={subtitle != null ? y + h / 2 - 4 : y + h / 2 + 5}
      textAnchor="middle"
      fill="var(--color-foreground)"
      fontSize={15}
      fontWeight={600}
    >
      {title}
    </text>
    {subtitle != null ? (
      <text
        x={x + w / 2}
        y={y + h / 2 + 15}
        textAnchor="middle"
        fill="var(--color-foreground-muted)"
        fontSize={12}
      >
        {subtitle}
      </text>
    ) : null}
  </g>
);

const CodeBlock: React.FC<{ children: string }> = ({ children }) => (
  <pre className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface-muted p-5 text-xs leading-relaxed text-foreground-secondary">
    <code className="font-mono">{children}</code>
  </pre>
);

const IntegrationPage: React.FC = () => (
  <main className="mx-auto w-full max-w-content flex-1 px-gutter py-10 sm:py-12">
    <header className="flex flex-col gap-3 border-b border-border pb-8">
      <h1 className="font-display text-title font-bold tracking-tight text-foreground">
        How the integration works
      </h1>
      <p className="max-w-2xl text-lead text-foreground-muted">
        The UI never talks to a data source directly. It depends on one adapter interface; the demo
        binds it to a simulated tenant, and a real deployment binds it to Workday. Swapping them is a
        one-line change with zero UI edits. The shapes below are Workday&rsquo;s real ones; only the
        connection is simulated.
      </p>
    </header>

    <section className="py-10" aria-label="Architecture">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Architecture
      </h2>
      <div className="mt-6 overflow-x-auto">
        <svg
          viewBox="0 0 720 300"
          className="h-auto w-full min-w-[640px]"
          role="img"
          aria-label="The UI depends on the WorkdayAdapter interface, resolved by getWorkdayAdapter to either a mock adapter backed by a simulated dataset, or a live adapter that calls the Workday tenant's RaaS and Staffing endpoints."
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--color-foreground-faint)" />
            </marker>
          </defs>

          <DiagramBox x={20} y={120} w={150} h={60} title="Demo UI" subtitle="dashboard · detail" />
          <DiagramBox
            x={230}
            y={112}
            w={180}
            h={76}
            title="WorkdayAdapter"
            subtitle="getWorkdayAdapter()"
            emphasis
          />
          <DiagramBox x={480} y={40} w={220} h={64} title="Mock adapter" subtitle="simulated dataset (demo)" />
          <DiagramBox x={480} y={196} w={220} h={64} title="Live adapter" subtitle="Workday tenant (production)" />

          {/* UI -> adapter */}
          <line
            x1={170}
            y1={150}
            x2={228}
            y2={150}
            stroke="var(--color-foreground-faint)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
          {/* adapter -> mock */}
          <line
            x1={410}
            y1={140}
            x2={478}
            y2={80}
            stroke="var(--color-foreground-faint)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
          {/* adapter -> live */}
          <line
            x1={410}
            y1={160}
            x2={478}
            y2={222}
            stroke="var(--color-foreground-faint)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
          <text x={512} y={150} fill="var(--color-foreground-faint)" fontSize={12}>
            selected by env vars
          </text>
        </svg>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        <code className="rounded-field bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
          getWorkdayAdapter()
        </code>{" "}
        returns the live adapter when the full set of env vars is present, and the mock otherwise.
        This demo ships no credentials, so it always runs on the mock and labels its data as
        simulated.
      </p>
    </section>

    <section className="border-t border-border py-10" aria-label="Authentication">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Authentication
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        Workday integrations authenticate with OAuth 2.0, not a generic API key. In the tenant you{" "}
        <span className="font-medium text-foreground">Register an API Client for Integrations</span>,
        which issues a client ID and secret. The client is bound to an{" "}
        <span className="font-medium text-foreground">Integration System User (ISU)</span> that holds
        a long-lived (often non-expiring) refresh token. At call time the adapter exchanges that
        refresh token for a short-lived (~1 hour) access token at the tenant&rsquo;s token endpoint,
        then sends it as a Bearer token. Scopes are granted as{" "}
        <span className="font-medium text-foreground">Functional Areas</span> (Staffing, Recruiting,
        custom-report access), not per-endpoint keys.
      </p>
      <CodeBlock>{TOKEN_SAMPLE}</CodeBlock>
    </section>

    <section className="border-t border-border py-10" aria-label="Adapter interface">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        The adapter interface
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        This is the entire seam. A live integration implements these reads against the endpoints
        below; the UI depends only on this contract. The one write is demo-local: onboarding status
        originates inside Workday and flows outbound, so a real app never writes it back.
      </p>
      <CodeBlock>{ADAPTER_INTERFACE}</CodeBlock>
    </section>

    <section className="border-t border-border py-10" aria-label="Endpoint map">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Endpoint map
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        Reads split across two surfaces: the Staffing REST API (limit/offset paging, objects wrapped
        in <code className="rounded-field bg-surface-muted px-1.5 py-0.5 font-mono text-xs">{"{id, descriptor, href}"}</code>{" "}
        envelopes) and a RaaS custom report for onboarding-task status (a top-level{" "}
        <code className="rounded-field bg-surface-muted px-1.5 py-0.5 font-mono text-xs">Report_Entry</code>{" "}
        array).
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-foreground-faint">
              <th className="py-2 pr-4 font-medium">Method</th>
              <th className="py-2 pr-4 font-medium">Adapter call</th>
              <th className="py-2 font-medium">Workday endpoint</th>
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map((row) => (
              <tr key={row.call} className="border-b border-border last:border-b-0">
                <td className="py-3 pr-4 align-top">
                  <span className="rounded-field bg-surface-muted px-2 py-0.5 font-mono text-xs text-foreground">
                    {row.method}
                  </span>
                </td>
                <td className="py-3 pr-4 align-top font-mono text-xs text-foreground-secondary">
                  {row.call}
                </td>
                <td className="py-3 align-top font-mono text-xs text-foreground-muted">
                  {row.endpoint}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">Staffing worker</h3>
          <CodeBlock>{STAFFING_SAMPLE}</CodeBlock>
        </div>
        <div>
          <h3 className="font-display text-lg font-semibold text-foreground">
            RaaS onboarding status
          </h3>
          <CodeBlock>{RAAS_SAMPLE}</CodeBlock>
        </div>
      </div>
    </section>

    <section className="border-t border-border py-10" aria-label="Direction of flow">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Direction of flow
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        Workday is the system of record and the event source. When the{" "}
        <span className="font-medium text-foreground">Hire business process</span> completes, that
        event is what mints the worker and drives provisioning{" "}
        <span className="font-medium text-foreground">outbound</span>: downstream systems create the
        account (Entra ID / AD) and set up payroll. External apps like this console{" "}
        <span className="font-medium text-foreground">read</span> status back out via a RaaS report or
        EIB batch. A demo that writes INTO Workday as a passive store inverts reality.
      </p>
      <div className="mt-6 overflow-x-auto">
        <svg
          viewBox="0 0 720 220"
          className="h-auto w-full min-w-[640px]"
          role="img"
          aria-label="The Hire event in Workday drives provisioning outbound to Entra ID / AD and payroll; the onboarding console reads status back out of Workday via a RaaS report."
        >
          <defs>
            <marker
              id="arrow2"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--color-foreground-faint)" />
            </marker>
          </defs>

          <DiagramBox x={20} y={80} w={200} h={72} title="Workday" subtitle="system of record · Hire event" emphasis />
          <DiagramBox x={470} y={16} w={230} h={56} title="Entra ID / AD" subtitle="account provisioning" />
          <DiagramBox x={470} y={92} w={230} h={56} title="Payroll" subtitle="pay & tax setup" />
          <DiagramBox x={470} y={160} w={230} h={48} title="This console" subtitle="reads status (RaaS)" />

          {/* Workday -> Entra (outbound, event-driven) */}
          <line x1={220} y1={104} x2={468} y2={46} stroke="var(--color-foreground-faint)" strokeWidth={1.5} markerEnd="url(#arrow2)" />
          {/* Workday -> Payroll (outbound) */}
          <line x1={220} y1={116} x2={468} y2={118} stroke="var(--color-foreground-faint)" strokeWidth={1.5} markerEnd="url(#arrow2)" />
          {/* console -> Workday (inbound read) */}
          <line x1={468} y1={184} x2={222} y2={140} stroke="var(--color-foreground-faint)" strokeWidth={1.5} markerEnd="url(#arrow2)" />
          <text x={250} y={70} fill="var(--color-foreground-faint)" fontSize={12}>
            event-driven, outbound
          </text>
          <text x={250} y={175} fill="var(--color-foreground-faint)" fontSize={12}>
            RaaS / EIB batch read
          </text>
        </svg>
      </div>
    </section>

    <section className="border-t border-border py-10" aria-label="Environment variables">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Environment variables
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        A real tenant is wired entirely through configuration. Set these on the deployment and{" "}
        <code className="rounded-field bg-surface-muted px-1.5 py-0.5 font-mono text-xs">
          getWorkdayAdapter()
        </code>{" "}
        switches to the live path. No secrets live in the codebase.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {ENV_VARS.map((env) => (
          <div key={env.name} className={cn(cardVariants(), "flex flex-col gap-1 p-4")}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <code className="font-mono text-sm font-semibold text-foreground">{env.name}</code>
              <code className="font-mono text-xs text-foreground-faint">{env.example}</code>
            </div>
            <p className="text-sm text-foreground-muted">{env.note}</p>
          </div>
        ))}
      </div>
    </section>
  </main>
);

export default IntegrationPage;
