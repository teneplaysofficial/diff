#!/bin/bash

set -euo pipefail

current_branch=$(git branch --show-current)

if [[ "$current_branch" != "main" ]]; then
  echo "Not on main branch (current: $current_branch), Aborting release."
  exit 1
fi

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
git tag v"$version" || echo "Tag $version already exists"

if [[ "$isPR" -eq 0 ]]; then
    git tag -f v"$major_version"
    git tag -f v"$major_minor_version"
fi

git push origin HEAD
git push origin v"$version"

if [[ "$isPR" -eq 0 ]]; then
  git push origin -f v"$major_version"
  git push origin -f v"$major_minor_version"
fi
