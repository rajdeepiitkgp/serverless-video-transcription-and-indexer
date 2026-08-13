# Serverless Video Transcription & Indexer

Event-driven video transcription pipeline on Azure with a web UI: upload videos in the
browser, watch them flow `Uploaded → Indexing → Processed` through Blob Storage →
Event Grid → Azure Functions → Azure Video Indexer, then play them back with closed
captions, a synced clickable transcript, chapters, and full-text search across everything
that was said — with insights in Cosmos DB and rich Discord notifications.

Everything is defined in Bicep and deployed from GitHub Actions via OIDC — the entire
stack can be destroyed and recreated with zero manual portal steps and no Azure
credential secrets in GitHub.

[![CI](https://github.com/rajdeepiitkgp/serverless-video-transcription-and-indexer/actions/workflows/ci.yml/badge.svg)](https://github.com/rajdeepiitkgp/serverless-video-transcription-and-indexer/actions/workflows/ci.yml)
[![test & coverage reports](https://img.shields.io/badge/test%20%26%20coverage-reports-blue)](https://rajdeepiitkgp.github.io/serverless-video-transcription-and-indexer/)
[![coverage: shared](https://img.shields.io/badge/dynamic/json?label=shared&query=%24.total.lines.pct&suffix=%25&url=https%3A%2F%2Frajdeepiitkgp.github.io%2Fserverless-video-transcription-and-indexer%2Fshared%2Fcoverage%2Fcoverage-summary.json)](https://rajdeepiitkgp.github.io/serverless-video-transcription-and-indexer/shared/coverage/)
[![coverage: webapi](https://img.shields.io/badge/dynamic/json?label=webapi&query=%24.total.lines.pct&suffix=%25&url=https%3A%2F%2Frajdeepiitkgp.github.io%2Fserverless-video-transcription-and-indexer%2Fwebapi%2Fcoverage%2Fcoverage-summary.json)](https://rajdeepiitkgp.github.io/serverless-video-transcription-and-indexer/webapi/coverage/)
[![coverage: pipeline](https://img.shields.io/badge/dynamic/json?label=pipeline&query=%24.total.lines.pct&suffix=%25&url=https%3A%2F%2Frajdeepiitkgp.github.io%2Fserverless-video-transcription-and-indexer%2Fpipeline%2Fcoverage%2Fcoverage-summary.json)](https://rajdeepiitkgp.github.io/serverless-video-transcription-and-indexer/pipeline/coverage/)

## Getting started

```bash
nvm use          # repo pins Node 24
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

## Documentation

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — the reviewed build contract
  (architecture, decisions, milestones)
- [CONTRIBUTING.md](CONTRIBUTING.md) — branching, commits, PR rules
- [docs/style-guide.md](docs/style-guide.md) — code style (tool-enforced)
- [docs/testing-principles.md](docs/testing-principles.md) — the testing pyramid
- [docs/setup.md](docs/setup.md) — one-time bootstrap + first deploy
- [docs/teardown-recreate.md](docs/teardown-recreate.md) — destroy/recreate the stack
- [docs/support-runbook.md](docs/support-runbook.md) — tracking ID → diagnosis → replay
