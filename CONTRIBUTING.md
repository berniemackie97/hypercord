# Contributing to Hypercord

## Issue triage
Use a bug report for observed defects, a feature proposal for user-facing changes, and an engineering task for operational or architectural work. Link existing epics, identify blocking issues, and describe acceptance criteria. Do not create duplicate tracking work.

## Change workflow
1. Start from the current default branch and create a focused branch.
2. Audit the relevant code and tests before making changes. Document the failure or behavior contract.
3. Implement one coherent, reviewable change; related issues may be completed in one PR if they share a bounded regression surface.
4. Add or update tests for normal behavior, failure paths, concurrency, permissions and durable state where relevant.
5. Run the checks below and report exact results in the PR template. Do not claim a check passed without executing it.
6. Request review and resolve blocking findings before merge. Never bypass a required check without documenting an explicit exception.

## Local tooling
Use the workspace's declared Node.js and pnpm toolchain. After restoring the CI toolchain, these are the intended root commands:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm test
pnpm format
```

The tracked engineering issues are the source of truth for CI and toolchain defects; commands above do not imply all current checks pass.

## Database and deployment changes
Review transaction boundaries and idempotency for all state mutations. Schema changes require committed migrations, forward/rollback testing, and a recovery plan. Deployment changes require a clean build, startup, health, shutdown and restart verification.

## Security and privacy
Apply least privilege to Discord and infrastructure access. Do not check in API keys, secrets, tokens, private messages or personal local configuration. Follow [SECURITY.md](SECURITY.md) for private vulnerability reports.
