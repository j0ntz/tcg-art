# Research: what Workday actually is, for a credible onboarding-integration demo

Compiled 2026-07-24 by a deep-research agent (Opus 4.8), primary-source-weighted. Consumer: the
Workday onboarding demo living on the preview-only branch jon/task-62 (PR #63). The demo currently
simulates invented API shapes; this doc is the ground truth to refactor it against.

## The model (vocabulary that signals fluency)

- WORKER is the umbrella object (subtypes: Employee, Contingent Worker). Never just "employee".
- PRE-HIRE: the person record before hire. The HIRE business process (BP) converts pre-hire ->
  worker, assigns a POSITION in a SUPERVISORY ORGANIZATION, mints Employee_ID + WID.
- Business Process Framework: Hire, Onboarding Setup, Change Job, Terminate; steps with
  approvals/to-dos routed to roles (Manager, HR Partner). Staffing events = state-changing BPs.
- Onboarding lives in layers: "Onboarding Setup" (the BP, drives new-hire tasks: personal info,
  tax withholding, direct deposit, emergency contacts, benefits, I-9, policy acks), "Onboarding
  Plans" (Talent product checklist experience), and "Journeys" (separate guided-experience
  product; do NOT conflate with the BP). Tenants: GMS demo tenant, Sandbox, Production;
  releases named 2025R1/2025R2.

## Integration surfaces (2025-2026)

- REST: https://{host}/ccx/api/{service}/{version}/{tenant}/{resource}, e.g.
  ccx/api/staffing/v6/{tenant}/workers (limit/offset pagination). Objects use
  {id: <WID>, descriptor, href} envelopes with nested references in the same shape.
- SOAP WWS (canonical, ~v45+): Get_Workers, Hire_Employee, Get_Pre_Hires; typed ID references
  (WID | Employee_ID | Contingent_Worker_ID), never bare ints.
- RaaS: https://{host}/ccx/service/customreport2/{tenant}/{owner}/{ReportName}?format=json;
  top-level key Report_Entry; JSON has no native pagination. THE realistic way an external app
  reads onboarding/hire status.
- WQL (SQL-like), EIB (batch file), Studio/Orchestrate (full orchestration).
- Auth: OAuth 2.0 via "Register API Client for Integrations" (Client ID/Secret), refresh token
  bound to an Integration System User (ISU, often non-expiring), ~1h access tokens from
  https://{host}/ccx/oauth2/{tenant}/token, scopes = Functional Areas. Generic "API key" = tell.

## Realistic flow

Offer accepted -> pre-hire -> Hire BP completes (THE event) -> Onboarding Setup BP + Plan/Journey
assigned -> tasks worked by hire/manager/HR -> downstream provisioning triggered OUTBOUND from
Workday (classic: Workday -> Entra/AD account creation) -> external dashboards read task status
via a RaaS "Onboarding Status" report or WQL. Workday is the system of record and event source;
demos that write INTO Workday as a passive store invert reality.

## The seven credibility corrections for the demo

1. Worker (with workerType Employee|Contingent Worker), not "employee".
2. Model pre-hire -> Hire BP -> worker; no "createEmployee" verbs.
3. Dual identifiers everywhere: WID (32-hex GUID, tenant-unique) + typed reference IDs
   ({type: "Employee_ID", value: "21001"}); positionId + supervisoryOrganization on workers.
4. Real URL shapes only (ccx/api/staffing/v6/... and customreport2 RaaS for status);
   api.workday.com/v1/employees-style paths are tells.
5. OAuth/ISU auth story on the integration page (client id/secret, ISU refresh token, 1h access
   tokens, Functional Area scopes, token endpoint).
6. Onboarding Setup BP vs Onboarding Plans vs Journeys named correctly; tasks as BP-step-driven
   to-dos with realistic names, routed to Manager/HR Partner.
7. Outbound provisioning framing (Hire event -> AD/Entra/payroll), event-driven vs RaaS/EIB batch.

Caveat: exact REST versions/fields drift per release; deepest schemas live behind authenticated
Workday Community docs. Shapes above are correct in structure and vocabulary.
