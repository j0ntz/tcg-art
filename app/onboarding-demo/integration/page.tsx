import type { Metadata } from "next";

import { cn } from "@/lib/utils";
import { cardVariants } from "@/app/components/ui/Card";

export const metadata: Metadata = {
  title: "How the integration works — Workday Demo",
  description:
    "The adapter boundary, endpoint map, and environment variables a real Workday tenant would use.",
};

// Static explainer for the integration story: the architecture, the adapter
// interface the UI depends on, the Workday endpoints each method maps to, and
// the env vars a live tenant needs. Server-rendered; no data source touched.

const ENV_VARS: { name: string; example: string; note: string }[] = [
  {
    name: "WORKDAY_TENANT_URL",
    example: "https://wd5-impl-services1.workday.com",
    note: "The tenant's API host.",
  },
  { name: "WORKDAY_TENANT", example: "northwind", note: "Tenant short name, used in every path." },
  {
    name: "WORKDAY_CLIENT_ID",
    example: "MTIz…",
    note: "OAuth 2.0 client ID for an Integration System User (ISU).",
  },
  {
    name: "WORKDAY_CLIENT_SECRET",
    example: "••••••••",
    note: "OAuth 2.0 client secret (client-credentials grant).",
  },
  {
    name: "WORKDAY_ONBOARDING_REPORT",
    example: "INT_Onboarding_Workers",
    note: "Optional: the RaaS report backing the worker list.",
  },
];

const ENDPOINTS: { method: string; call: string; endpoint: string }[] = [
  {
    method: "GET",
    call: "listOnboardingWorkers()",
    endpoint: "/ccx/service/customreport2/{tenant}/{report}  (RaaS)",
  },
  {
    method: "GET",
    call: "getWorker(id) / getHire(id)",
    endpoint: "/ccx/api/staffing/v6/{tenant}/workers/{id}",
  },
  {
    method: "GET",
    call: "getJobRequisition(id)",
    endpoint: "/ccx/api/recruiting/v5/{tenant}/jobRequisitions?worker={id}",
  },
  {
    method: "GET",
    call: "listOnboardingTasks(id)",
    endpoint: "/ccx/api/staffing/v6/{tenant}/workers/{id}/onboardingTasks",
  },
  {
    method: "POST",
    call: "updateOnboardingTaskStatus(id, status)",
    endpoint: "/ccx/api/staffing/v6/{tenant}/onboardingTasks/{id}",
  },
];

const ADAPTER_INTERFACE = `export interface WorkdayAdapter {
  readonly mode: "mock" | "live";

  // RaaS worker report -> every hire in onboarding
  listOnboardingWorkers(): Promise<HireRecord[]>;

  // Staffing / Recruiting GETs
  getHire(workerId: string): Promise<HireRecord | null>;
  getWorker(workerId: string): Promise<WorkdayWorker | null>;
  getJobRequisition(workerId: string): Promise<WorkdayJobRequisition | null>;
  listOnboardingTasks(workerId: string): Promise<WorkdayOnboardingTask[]>;

  // Staffing business-process action (write)
  updateOnboardingTaskStatus(
    taskId: string,
    status: TaskStatus,
  ): Promise<WorkdayOnboardingTask>;
}`;

// A labeled box in the architecture diagram. currentColor + CSS-var fills keep
// it theme-aware in both light and dark with no duplicated markup.
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

const IntegrationPage: React.FC = () => (
  <main className="mx-auto w-full max-w-content flex-1 px-gutter py-10 sm:py-12">
    <header className="flex flex-col gap-3 border-b border-border pb-8">
      <h1 className="font-display text-title font-bold tracking-tight text-foreground">
        How the integration works
      </h1>
      <p className="max-w-2xl text-lead text-foreground-muted">
        The UI never talks to a data source directly. It depends on one adapter interface; the demo
        binds it to a simulated tenant, and a real deployment binds it to Workday. Swapping them is a
        one-line change with zero UI edits.
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
          aria-label="The UI depends on the WorkdayAdapter interface, resolved by getWorkdayAdapter to either a mock adapter backed by a simulated dataset, or a live adapter that calls the Workday tenant's RaaS, Staffing, and Recruiting endpoints."
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
        returns the live adapter when all four required env vars are present, and the mock otherwise.
        This demo ships no credentials, so it always runs on the mock and labels its data as
        simulated.
      </p>
    </section>

    <section className="border-t border-border py-10" aria-label="Adapter interface">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        The adapter interface
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-foreground-muted">
        This is the entire seam. A live integration implements these six methods against the
        endpoints below; the UI depends only on this contract.
      </p>
      <pre className="mt-6 overflow-x-auto rounded-panel border border-border bg-surface-muted p-5 text-xs leading-relaxed text-foreground-secondary">
        <code className="font-mono">{ADAPTER_INTERFACE}</code>
      </pre>
    </section>

    <section className="border-t border-border py-10" aria-label="Endpoint map">
      <h2 className="font-display text-heading font-bold tracking-tight text-foreground">
        Endpoint map
      </h2>
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
        switches to the live path. Authentication is OAuth 2.0 client credentials; no secrets live in
        the codebase.
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
