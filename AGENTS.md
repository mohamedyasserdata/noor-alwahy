## Noor Al-Wahy shared project rules

This repository is the shared source of truth for every developer and Codex session.

### Start and resume

1. Read `.specify/memory/constitution.md` and `docs/PROJECT_STATUS.md` first.
2. Read only the active task and its directly relevant spec sections; do not repeat completed work.
3. Preserve all existing work. Never discard, reset, or rewrite user changes.
4. Update `docs/PROJECT_STATUS.md` with the active task, checkpoint, real test evidence, blockers,
   and next step before every meaningful checkpoint.

### Quality and security

- Follow the task order and acceptance criteria in `specs/001-noor-alwahy/`.
- Run focused tests for each change and the full quality/database/RLS gate at phase boundaries.
- Never mark a test or task complete unless it actually passed.
- Do not weaken RLS, authentication, financial controls, audit trails, or sensitive-data checks to
  save time or tokens.
- Keep credentials only in ignored local environment files. Commit placeholders only in
  `.env.example`; never commit personal Codex settings, tokens, or machine-specific paths.
- Project-local skills are versioned under `.agents/skills/` with `skills-lock.json`. Use only the
  skill relevant to the current task; do not copy global or account-specific Codex configuration.

### Git and multi-device workflow

- `main` contains completed, tested checkpoints. Incomplete feature work must live on a branch named
  `work/<task-id>-<short-name>` and be checkpointed there.
- Before starting work, run `git fetch --prune`, update `main` with `git pull --ff-only`, and confirm
  in `docs/PROJECT_STATUS.md` that another device is not already editing the same task.
- Use one active writer per task branch. Different devices must use different task branches and
  integrate through a pull request or an explicit, reviewed merge.
- Treat a task completed and pushed by the other device as an accepted handoff when its focused
  tests and exact results are recorded in `docs/PROJECT_STATUS.md`. Continue with the next task;
  do not re-review its implementation or rerun its focused tests. Re-test only code changed by the
  current device and run the shared full quality/database/RLS gate once at the phase boundary.
- Fetching remote refs and checking task ownership is still required to avoid duplicate work; it is
  coordination, not a second implementation review.
- Create an independent commit for each completed task. Create descriptive checkpoint commits for
  meaningful unfinished progress, and record the exact continuation point in `PROJECT_STATUS.md`.
- Never use force push, history rewriting, or destructive Git commands. Resolve divergence by
  fetching, reviewing, and merging/rebasing only with the repository owner's approval.
- The first push to a newly connected remote requires explicit owner approval. Once that approval is
  recorded, push meaningful completed and in-progress checkpoints automatically to their matching
  remote branches.
- Full setup and handoff instructions are in `docs/MULTI_DEVICE_GIT.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
