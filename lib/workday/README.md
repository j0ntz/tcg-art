# Workday integration layer (onboarding demo)

The adapter boundary for the onboarding demo (issue #62, refactored in #64 to
match the real Workday product per `docs/research/workday-integration.md`). The
UI depends on ONE interface, `WorkdayAdapter`; the demo binds it to a simulated
tenant and a real deployment binds it to Workday, with no UI changes.

## Model

Vocabulary follows Workday's own. A person is a WORKER (`workerType` Employee or
Contingent Worker), not an "employee". The lifecycle is pre-hire -> Hire business
process -> worker: a pre-hire record carries only a `Pre_Hire_ID`, and completing
the Hire BP is what mints the WID (32-hex GUID), the typed Employee_ID /
Contingent_Worker_ID reference, and the position. Onboarding Setup is the
business process that drives the new-hire task list (personal info, tax
withholding, direct deposit, emergency contacts, I-9, benefits, policy acks),
routed to Worker / Manager / HR Partner / IT roles.

## Files

- `types.ts` — domain types (`WorkdayWorker` with `wid` + typed `references`,
  `WorkdayJobRequisition`, `WorkdayOnboardingTask`, `HireRecord`), the lifecycle
  stage / status enums, and the real Workday wire shapes (`StaffingWorker` with
  `{id, descriptor, href}` envelopes, `OnboardingStatusReport` with a top-level
  `Report_Entry` array).
- `mock-data.ts` — the simulated dataset (14 fictional workers, generated tasks,
  a few still pre-hire). Entirely fake; nothing comes from or reaches Workday.
- `adapter.ts` — the `WorkdayAdapter` interface, the mock implementation
  (`createMockWorkdayAdapter`), a documented live stub (`createLiveWorkdayAdapter`),
  and the factory (`getWorkdayAdapter`).
- `progress.ts` — pure pipeline derivations shared by the dashboard and detail view.

## Going live

`getWorkdayAdapter()` returns the live adapter when these env vars are all set,
and the mock otherwise:

| Var | Example | Purpose |
| --- | --- | --- |
| `WORKDAY_TENANT_HOST` | `https://wd5-impl-services1.workday.com` | Tenant API host |
| `WORKDAY_TENANT` | `northwind` | Tenant short name (used in every path) |
| `WORKDAY_CLIENT_ID` | — | OAuth 2.0 client ID (Register API Client for Integrations) |
| `WORKDAY_CLIENT_SECRET` | — | OAuth 2.0 client secret |
| `WORKDAY_REFRESH_TOKEN` | — | ISU-bound refresh token (often non-expiring) |

Reads split across two surfaces: the Staffing REST API
(`ccx/api/staffing/v6/{tenant}/workers`, limit/offset paging,
`{id, descriptor, href}` envelopes) and a RaaS custom report for onboarding-task
status (`ccx/service/customreport2/{tenant}/{owner}/Onboarding_Status?format=json`,
top-level `Report_Entry`). Authenticate with OAuth 2.0: exchange the ISU refresh
token for a ~1h access token at `ccx/oauth2/{tenant}/token`, then send it as a
Bearer token. Workday is the system of record for onboarding status, so there is
no live write path; status is read outbound and the demo's task toggle is a
session-local simulation. The `/onboarding-demo/integration` page renders the
same map, auth story, and sample payloads for viewers.
