# tcg-art

A Next.js web app on Vercel, built and maintained hands-off by the [site-orch](https://github.com/j0ntz/site-orch) agent orchestration. Tasks are GitHub issues on the project board; the orch works, verifies and lands them.

- Orchestration: how the board, agents, verify and landing work is the site-orch README. This repo carries only the [per-tenant contract](orchestration/README.md): `orch.config.json`, the skill copies, and its Playwright flows.
- Product spec: [docs/spec.md](docs/spec.md). Design system: [docs/design-system.md](docs/design-system.md).
- Run reports from the orch: [docs/run-reports/](docs/run-reports/).
