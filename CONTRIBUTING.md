# Contributing to APEX

Thanks for helping build APEX. This repo holds financial smart-contract code —
contributions are held to a high bar for testing and review.

## Repository layout

- `contracts/apex-futures/` — Soroban contract (Rust). Highest-risk code.
- `frontend/` — Next.js dApp.
- `scripts/` — reference keepers (oracle feeder, liquidation).
- Docs: `README.md`, `SECURITY.md`, `OPERATIONS.md`, `contracts/DEPLOYMENT.md`.

## Local checks (run before pushing)

```bash
# Contract
cargo fmt --all --check
cargo clippy -p apex-futures --all-targets -- -D warnings
cargo test -p apex-futures            # 26 tests incl. property/fuzz

# Frontend
cd frontend && npx tsc --noEmit && npm run build
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of the above
on every PR and must be green to merge.

## Branch & PR conventions

- Branch from `main` (or the current integration branch): `feat/…`, `fix/…`, `docs/…`.
- One logical change per PR. Fill in the PR template.
- Conventional-commit style messages (`feat(contracts): …`, `fix(frontend): …`).
- Contract changes **must** include tests and preserve the solvency invariant
  (`vault == total_collateral + fee_vault + insurance_fund`).
- Changing the contract's public interface requires regenerating the TypeScript
  bindings (`frontend/packages/apex-futures`) and updating `SECURITY.md`.

## Review

`CODEOWNERS` gates contract, security, and CI changes. Two things reviewers always
check: (1) is the solvency invariant preserved, and (2) are new privileged
functions behind the correct RBAC role and, where relevant, the timelock.

## Security

Do not open public issues for vulnerabilities — see [`SECURITY.md`](SECURITY.md)
for private disclosure.
