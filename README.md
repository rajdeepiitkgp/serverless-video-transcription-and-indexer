# Serverless Video Transcription & Indexer

Event-driven video transcription pipeline on Azure with a web UI: upload videos in the
browser, watch them flow `Uploaded → Indexing → Processed` through Blob Storage →
Event Grid → Azure Functions → Azure Video Indexer, then play them back with closed
captions, a synced clickable transcript, chapters, and full-text search across everything
that was said — with insights in Cosmos DB and rich Discord notifications.

Everything is defined in Bicep and deployed from GitHub Actions via OIDC — the entire
stack can be destroyed and recreated with zero manual portal steps and no Azure
credential secrets in GitHub.

<!-- CI / coverage badges land in M6 (test reports on GitHub Pages) -->

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
