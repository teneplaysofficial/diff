# Diff Sentinel

_Fail CI when generated or formatted files are not committed_

[![ci](https://github.com/teneplaysofficial/diff/actions/workflows/ci.yml/badge.svg)](https://github.com/teneplaysofficial/diff)

## Overview

**Diff-Sentinel** runs your code-generation or formatting commands, checks `git diff`, and fails the workflow if uncommitted changes are detected with clear annotations, structured logs, and a rich Job Summary.

### Why diff-sentinel?

Because CI should:

- Tell you **what changed**
- Explain **why it failed**
- Show **how to fix it**

## Inputs

### `run` **(required)**

Shell commands to execute **before** checking for a git diff.

Commands are executed **line-by-line**, and all commands run even if one fails.

### `fail-message` _(optional)_

Custom message shown when uncommitted changes are detected and the workflow fails.

**Default**

```txt
Generated or formatted files are out of date, Please run the required commands locally.
```

### `fail-on-command-error` _(optional)_

Whether the action should fail if **any command exits with a non-zero status**.

- `false` → commands may fail, but CI only fails on diff
- `true` → CI fails if any command fails

**Default:** `false`

### `fail-on-diff` _(optional)_

Whether the action should fail when an uncommitted git diff is detected.

**Default:** `true`

## Outputs

### `has_diff`

Indicates whether an uncommitted git diff was detected (`true`/`false`).

### `changed_files`

List of files that have uncommitted changes.

### `diff_count`

Total number of files with uncommitted changes.

### `command_failures`

Number of commands that failed during execution.

## Example

You can save this as `.github/workflows/diff.yml`.

```yml
name: Diff Sentinel Check

on:
  push:
    branches: [main]
  pull_request:

jobs:
  diff-sentinel:
    name: Enforce Clean Git Diff
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Setup Node & pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install

      - id: diff
        name: Run Diff Sentinel
        uses: teneplaysofficial/diff@v1
        with:
          run: |
            pnpm build
            pnpm gen
            pnpm fmt
          fail-message: "Generated or formatted files are out of date. Please regenerate and commit."
          fail-on-command-error: false
          fail-on-diff: true

      - name: Inspect Diff Sentinel outputs
        if: always()
        run: |
          echo "Has diff: ${{ steps.diff.outputs.has_diff }}"
          echo "Changed files:"
          echo "${{ steps.diff.outputs.changed_files }}"
          echo "Number of changed files: ${{ steps.diff.outputs.diff_count }}"
          echo "Command failures: ${{ steps.diff.outputs.command_failures }}"
```

> [!NOTE]
>
> - `if: always()` ensures outputs are printed even if the action fails.
> - `id: diff` is required to access outputs.
> - Job name (Enforce Clean Git Diff) appears clearly in the Actions UI.
> - The workflow runs on pull requests and pushes to `main`.
