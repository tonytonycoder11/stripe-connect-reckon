# Security Policy

## Supported versions

This project is pre-1.0. Security fixes land on the latest published version on npm.

## Reporting a vulnerability

Please report security issues **privately** through GitHub's private vulnerability
reporting: open the repository's **Security** tab → **Report a vulnerability**. Do not
open a public issue for a security report.

This is a **read-only** library: it never writes to Stripe and never moves funds. The
most relevant concerns are therefore mishandling of secret keys by integrations,
dependency vulnerabilities, or detection logic that could mislead an operator. Reports on
any of these are welcome.

When reporting, **do not include real Stripe secret keys or live data** — use redacted or
test-mode examples only.
