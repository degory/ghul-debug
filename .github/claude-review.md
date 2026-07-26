# Cloud code review brief

Instructions for the reviewer invoked from the `code_review` job in `.github/workflows/CICD.yaml`. Not loaded by local Claude Code; only the cloud reviewer reads this.

## How to operate

- The PR branch is checked out in the working directory.
- PR context is already fetched into `.review-context/` — read those files rather than calling `gh` again:
  - `diff.patch` — the full unified diff
  - `pr.json` — title, body, author, base/head refs, file counts, commits, labels
  - `comments.json` — top-level comments on the PR
  - `reviews.json` / `review-comments.json` — prior reviews and inline findings, so you can avoid repeating a point already made or already resolved
- Read `comments.json` before flagging anything as "unjustified", "approach unclear", or "this looks wrong". Rationale that doesn't belong in the changelog-shape description body often lives there: a subtle invariant the diff hides, why this approach over a tempting alternative, a deliberate oddity.
- Read the changed source files in full when context matters — the diff alone often hides whether a contract is upheld.
- Post findings only to GitHub. Anything you say in chat is invisible.

## What to post, where

**Post exactly one formal review per run.** The event is a binary choice on whether you are raising anything at all:

- **Nothing to raise** — `gh pr review <N> --approve --body "<one-sentence summary>"`. Approval is the merge signal, so always post it explicitly rather than staying silent — a skipped review is indistinguishable from a stuck bot. Do not approve while raising reservations of any kind.
- **One or more findings, any severity** — write a JSON file and POST it:

  ```
  gh api repos/<OWNER>/<REPO>/pulls/<N>/reviews -X POST --input review.json
  ```

  ```json
  {
    "event": "REQUEST_CHANGES",
    "body": "<optional cross-cutting summary; can be empty>",
    "comments": [
      {"path": "<repo-relative file>", "line": <new-side line>, "body": "<finding>"}
    ]
  }
  ```

  One finding per `comments[]` entry, anchored to the line it concerns. Use `body` only for commentary that genuinely spans the whole diff. `side` defaults to `RIGHT`; add `"side": "LEFT"` only when anchoring to a deleted line.

- **Every `comments[]` entry must anchor to a line that appears in this PR's diff.** The endpoint rejects the whole POST with a 422 if any single entry falls outside the diff hunks, discarding every other finding with it. When a finding concerns code the diff doesn't touch, put it in `body` instead of anchoring it.
- **Never use `event: COMMENT`** — it doesn't satisfy branch protection, so the PR sits stuck. **Never approve while carrying inline findings** — auto-merge can land the PR before the author reads them.
- **There is no "non-blocking" verdict.** If a finding is worth saying out loud, it's worth blocking on. If it isn't worth blocking, stay silent. Closing notes like "neither blocks merge", "minor nit…", "consider…" are incoherent with the workflow.
- `/tmp` is not writeable; write `review.json` into the working directory.

## What CI covers, so you don't have to

You run **in parallel with CI**, so its jobs may still be in flight — but whether the TypeScript compiles and the `.vsix` builds is settled by CI and branch protection before anything merges. That is not your job. **Don't try to mentally compile the diff, run tests, or second-guess validity.** Spend your attention on what the test suite can't catch.

## What this repo is

`ghul-debug` is the VS Code debugger extension for the ghūl language. It's a thin wrapper that registers a `ghul` debug type and spawns `netcoredbg` (Samsung's open-source .NET DAP server) as the debug adapter — the user supplies a netcoredbg binary either via the `ghul.debug.netcoredbgPath` setting or on `$PATH`.

The whole extension is a single `src/extension.ts`. It does three things:

1. Registers a `DebugAdapterDescriptorFactory` that returns a `DebugAdapterExecutable` pointing at netcoredbg with `--interpreter=vscode`.
2. Registers a `DebugConfigurationProvider` that synthesises a default launch config when F5 is hit with no `launch.json`, and refuses `.exe` paths up-front (netcoredbg silently E_FAILs on .exe; it needs .dll).
3. Contributes the debug-type, breakpoint-language, and `ghul.debug.netcoredbgPath` setting via `package.json`.

Cross-repo coupling: depends on the compiler emitting Portable PDBs with absolute-path Document records and useful sequence points — landed in the `ghul` repo behind the `--debug` flag.

## Severity bar

Flag:

- Bugs and likely-bugs (TypeScript correctness errors `tsc` can miss — wrong type assertions, runtime narrowing that contradicts the type, swallowed promises).
- Security issues (path injection, command injection — the extension shells out to netcoredbg with a user-configurable path).
- Manifest/package.json correctness — debug-contribution shape, activation events, schema mismatches that VSCode would silently ignore.

Don't flag:

- Style preferences. Formatting. Naming taste.
- "Consider extracting this into a function" for small functions.
- Anything `npx @vscode/vsce package` already caught.

## Repo conventions

- Bot identity (`ghul-coder[bot]`) is the author of all bot-created commits and PRs.
- Single-file extension — don't propose a multi-file split unless complexity genuinely warrants it.
- No bundled debugger binary in the extension — user-supplied. Don't suggest bundling without explicit discussion.
- Versioning: `VERSION` file is the source of truth; `create-version` resolves the next semver. `#minor`/`#major` markers in PR bodies are inert — raise `VERSION` to cut a minor/major release.
