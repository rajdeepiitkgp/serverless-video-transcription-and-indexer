#!/usr/bin/env bash
# Verify a function-app deploy artifact is standalone before upload.
# pnpm's default symlink layout does not survive the functions-action
# zip → server-side extract (2026-08-13 incident: green deploy, host loads
# zero functions — CLAUDE.md artifact gotcha), and the host only discovers
# entrypoints via package.json "main" next to host.json.
set -euo pipefail

dir="${1:?usage: verify-function-artifact.sh <artifact-dir>}"
cd "$dir"

for f in host.json package.json; do
  if [[ ! -f "$f" ]]; then
    echo "::error::$f missing from artifact — the host would load zero functions."
    exit 1
  fi
done

# Symlinks (outside node_modules/.bin, which nothing loads at runtime) would
# dangle after the zip → extract on the server.
if find node_modules -type l | grep -v '/\.bin/' | grep .; then
  echo "::error::Artifact contains symlinks — they will not survive zip deployment."
  exit 1
fi

# Import every entrypoint the host will discover (the package.json "main"
# glob) — fails on unresolvable deps, and on a glob matching nothing.
node --input-type=module -e "
  import { readFileSync, globSync } from 'node:fs';
  const main = JSON.parse(readFileSync('package.json', 'utf8')).main;
  const files = globSync(main);
  if (files.length === 0) throw new Error('no entrypoints match package.json main: ' + main);
  for (const f of files) {
    await import('./' + f);
    console.log('resolves:', f);
  }"
