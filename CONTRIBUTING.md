# Contributing to Hypercord

## Planning and triage

The [Hypercord Roadmap](https://github.com/users/berniemackie97/projects/8) is the planning board; repository issues and milestones hold technical acceptance evidence. Use bug, feature and engineering issue forms, reference existing work, identify dependencies and state verification criteria before implementation.

## Change workflow

1. Audit existing code, tests and live project dependencies before selecting a ready issue.
2. Implement a coherent change with tests covering normal behavior and relevant failures, concurrency and authorization.
3. Use the workspace's pinned pnpm toolchain; commit only source and intentionally shared configuration.
4. Run the project checks and record exact outcomes in the PR. Never claim tests or recovery scenarios were exercised without evidence.
5. Resolve blocking review feedback and CI failures before merging. Do not suppress checks, rewrite history or mark issues complete without the required evidence.

## Local checks

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter @hypercord/bot test:coverage
```

The full-repository formatting gate and 80% test-coverage objective remain tracked in [Issue #9](https://github.com/berniemackie97/hypercord/issues/9). Avoid interpreting the measured CI regression floors as release acceptance.

## Schema and deployment changes

Include committed migrations, idempotency checks and rollback/recovery plans for persistent state. Verify container build, startup, readiness, shutdown and restart separately; a passing image build is not proof of an authenticated Discord deployment.

## Security

Do not commit API credentials, tokens, private message content, or personal machine settings. Pull requests must pass dependency review and secret scanning; see [SECURITY.md](SECURITY.md) for private reporting and credential rotation requirements.
