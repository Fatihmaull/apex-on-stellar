<!-- Describe the change and its motivation. -->

## Summary

## Type of change
- [ ] Contract logic (requires re-audit consideration)
- [ ] Frontend
- [ ] CI / tooling / docs

## Checklist
- [ ] `cargo test -p apex-futures` passes
- [ ] `cargo fmt --all --check` and `cargo clippy -- -D warnings` clean
- [ ] `cd frontend && npx tsc --noEmit && npm run build` pass
- [ ] Contract changes: added/updated tests and considered the solvency invariant
- [ ] Contract interface changed → regenerated TS bindings and updated `SECURITY.md`
- [ ] Docs updated (`README.md` / `SECURITY.md` / `contracts/DEPLOYMENT.md` / `OPERATIONS.md`)

## Risk / rollback
<!-- What could break, and how to revert. -->
