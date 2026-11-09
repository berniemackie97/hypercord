# Security policy

## Private reports

Please report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/berniemackie97/hypercord/security/advisories/new), not public issues. Include a concise reproduction, affected commit, impact and redacted evidence.

If private vulnerability reporting is unavailable, contact the repository owner privately through an existing trusted channel. Never post live secrets or private message contents in issues, pull requests, or CI logs.

## Credential handling

Secrets must be supplied through the deployment environment or an appropriate secret manager. Local tool permissions and machine-specific configuration must not be committed.

Secret scanning runs for pull requests and pushes to `main`, including repository history. A scan cannot guarantee that no secret was ever exposed. If credentials have been published, revoke and rotate them; deleting a file from the current branch does not remove it from Git history or caches.

Dependency review blocks newly introduced high- and critical-severity advisories. It does not prove that existing dependencies are vulnerability-free. Review Dependabot alerts, changes and supported fixes before releasing.

## Scope and response

Security-sensitive functionality includes Discord gateway intents and permissions, provider credentials and billing, message retention, moderation, financial-style balances, data storage and background workers.

The maintainer assesses reports and coordinates remediation. No response-time or supported-version SLA is asserted until a release support policy has been established.
