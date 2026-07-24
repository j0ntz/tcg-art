# Workday integration layer (onboarding demo)

The adapter boundary for the onboarding demo (issue #62). The UI depends on ONE
interface, `WorkdayAdapter`; the demo binds it to a simulated tenant and a real
deployment binds it to Workday, with no UI changes.

## Files

- `types.ts` — Workday-shaped domain types (`WorkdayWorker`, `WorkdayJobRequisition`,
  `WorkdayOnboardingTask`, `HireRecord`) and the onboarding stage/status enums.
- `mock-data.ts` — the simulated dataset (14 fictional hires, generated tasks).
  Entirely fake; nothing comes from or reaches Workday.
- `adapter.ts` — the `WorkdayAdapter` interface, the mock implementation
  (`createMockWorkdayAdapter`), a documented live stub (`createLiveWorkdayAdapter`),
  and the factory (`getWorkdayAdapter`).
- `progress.ts` — pure pipeline derivations shared by the dashboard and detail view.

## Going live

`getWorkdayAdapter()` returns the live adapter when these env vars are all set,
and the mock otherwise:

| Var | Example | Purpose |
| --- | --- | --- |
| `WORKDAY_TENANT_URL` | `https://wd5-impl-services1.workday.com` | Tenant API host |
| `WORKDAY_TENANT` | `northwind` | Tenant short name (used in every path) |
| `WORKDAY_CLIENT_ID` | — | OAuth 2.0 client ID (Integration System User) |
| `WORKDAY_CLIENT_SECRET` | — | OAuth 2.0 client secret (client-credentials grant) |
| `WORKDAY_ONBOARDING_REPORT` | `INT_Onboarding_Workers` | Optional RaaS report path |

Implement the six methods in `createLiveWorkdayAdapter` against the endpoints
named inline there (RaaS worker report, Staffing/Recruiting REST GETs, and the
Staffing business-process POST for status writes), authenticating with OAuth 2.0
client credentials. The `/onboarding-demo/integration` page renders the same map
for viewers.
