# ADR-0004: AI review is opt-in (label or mention), not automatic

- **Status**: Accepted
- **Date**: 2026-08-13
- **Amends**: IMPLEMENTATION_PLAN.md §9 (ai-review.yml: "Claude Code reviews every
  same-repo PR automatically").

## Context

Every ai-review.yml run spends Anthropic API credits from the owner's account.
The plan's every-PR automation also re-reviews on **every push** to an open PR,
and real PR iteration multiplies that: the 2026-08-13 deploy-incident PRs (#19,
#20) each accumulated five-plus review rounds. The reviews were genuinely useful
(both PRs took reviewer findings), but the owner flagged the cumulative cost as
too high for this project's budget — automation-by-default is the wrong default
here.

## Decision

The `auto-review` job runs only while the PR carries the **`ai-review` label**:
add the label to opt a PR in (every subsequent push is then reviewed until the
label is removed). The maintainer **`@claude` comment** path is unchanged and
remains the only route for fork PRs. Nothing reviews automatically by default.

The label is one-time GitHub configuration (created via `gh label create`), like
the repo's environment variables — the Bicep-only rule governs Azure resources,
not GitHub repo config.

## Consequences

- Default PR flow costs zero API credits; the owner chooses per-PR (label for
  continuous review while iterating, `@claude` comment for a one-shot pass).
- The `verify` required check is unaffected — AI review was never a merge gate.
- A PR labeled `ai-review` still cancels superseded runs on force-of-pushes
  (`cancel-in-progress: true`), keeping opted-in cost bounded.
- If the label is deleted from the repo, opting in silently becomes impossible —
  recreate it with `gh label create ai-review`.
