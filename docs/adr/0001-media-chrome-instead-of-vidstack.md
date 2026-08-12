# ADR-0001: Watch-page player is media-chrome, not Vidstack

- **Status**: Accepted
- **Date**: 2026-08-12
- **Amends**: IMPLEMENTATION_PLAN.md §4 (apps/web player), exercising the fallback
  pre-authorized in §14 ("Vidstack fit … evaluated first in M4; fallback: media-chrome
  or plain `<video>` + custom controls").

## Context

The plan named Vidstack for the watch-page player but explicitly gated it on an M4
evaluation of maintenance and fit. That evaluation (2026-08-12, npm registry):

- `@vidstack/react`'s `latest` release is **0.6.15**, whose peer dependencies pin
  **React ^18 only** — it cannot install against this repo's React 19.
- The maintained 1.x line (1.15.6) has shipped exclusively under the `next` prerelease
  dist-tag since 2023 and has never been promoted to a stable release. Depending on a
  prerelease tag conflicts with the repo's new-dependencies-at-latest policy and makes
  Dependabot semantics unreliable.
- **media-chrome** (4.19.2 at evaluation) is actively maintained with stable releases,
  is framework-agnostic web components with first-class React bindings
  (`media-chrome/react`), and has no restrictive peer dependencies.

## Decision

Use **media-chrome** for the watch-page player, themed via the Signal CSS tokens
(`.signal-player` in `apps/web/src/app/globals.css`). The plan's player requirements
are unchanged: custom themed controls, CC toggle from `transcript.vtt`, playback
speed, PiP, fullscreen, keyboard shortcuts (built into `<media-controller>`),
buffered/seek bar, and chapters (JSON chapters → WebVTT `chapters` track built
client-side in `src/lib/chapters-vtt.ts`). The SAS/VTT plumbing is identical to what
Vidstack would have used, as §14 anticipated.

## Consequences

- No prerelease dependencies; Dependabot tracks media-chrome normally.
- Chapter markers render through the chapters text track / our own chapter list UI
  rather than a library-specific chapters menu.
- If media-chrome ever stalls, the remaining §14 fallback (plain `<video>` + custom
  controls) still applies; the player is isolated behind
  `src/components/player/video-player.tsx`, so a swap stays local to that component.
