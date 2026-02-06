#!/bin/bash

set -euo pipefail

npx -y release-hub@beta
pnpm run build

version=$(jq -r '.version' package.json)
isPR=0

if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+[.-] ]]; then
  isPR=1
fi

IFS='.-' read -r major minor patch rest <<< "$version"

major_version="$major"
major_minor_version="$major.$minor"

git add .
git commit -m "chore: release v$version" || echo "No changes to commit"
git tag "$version" || echo "Tag $version already exists"

if [[ "$isPR" -eq 0 ]]; then
    git tag -f "$major_version"
    git tag -f "$major_minor_version"
fi

git push --follow-tags
