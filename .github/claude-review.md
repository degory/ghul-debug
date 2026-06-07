# Cloud code review brief

Instructions for the Anthropic Claude Code Action invoked from the `code_review` job in `.github/workflows/CICD.yaml`. Not loaded by local Claude Code; only the cloud reviewer reads this.

## How to operate

- The PR branch is checked out in the working directory.
- **You may be re-invoked on every push to the branch.** `pull_request` retriggers on `synchronize`; each run is a fresh context with no memory of prior reviews. Before reviewing, run `gh pr view <N> --json reviews` and read any prior review you posted on this PR. The verdict body summarises what you raised — treat the new commits since that review as the author's response to it. Don't re-raise a finding the diff has addressed; acknowledge it in one phrase in the verdict body if relevant. A verdict that flips direction across pushes (`--approve` ↔ `--request-changes`) deserves one sentence of explanation — silent flips confuse the author.
- Get the diff via `gh pr diff <N>`, the body via `gh pr view <N> --json title,body`.
- Get author-supplied PR comments via `gh pr view <N> --json comments`. Rationale that doesn't belong in the changelog-shape description body lives there: a subtle invariant the diff hides, why this approach over a tempting alternative, a deliberate oddity. Read comments before flagging anything as "unjustified", "approach unclear", or "this looks wrong" — the answer may already be in a comment.
- Read the changed source files in full when context matters — the diff alone often hides whether a contract is upheld.
- Post findings only to GitHub. Anything you say in chat is invisible.

## What to post, where

- **Inline comments** for specific code findings: `mcp__github_inline_comment__create_inline_comment` with `confirmed: true`. One finding per comment; don't pile multiple unrelated concerns into one.
- **End every review with one `gh pr review` verdict.** Pick exactly one:
  - `gh pr review <N> --approve --body "<one-sentence summary>"` — no findings worth raising. Approval is the merge signal: auto-merge is usually on, and even when it isn't, an approved PR is one button-click from landing. Do not approve while raising reservations of any kind.
  - `gh pr review <N> --request-changes --body "<one-paragraph summary of the theme>"` — at least one finding should hold up the merge.
- **The approve body is a brief positive summary, nothing more.** One sentence describing what the PR does. It is not a place to add caveats, "BTW", "minor nit", or "consider…" observations alongside the approval. If you find yourself wanting to add a qualification, that qualification *is* a finding — drop the approval, raise it as an inline comment, and switch the verdict to `--request-changes`.
- **There is no "non-blocking" verdict.** If a finding is worth saying out loud, it's worth blocking on. Closing notes like "neither blocks merge", "non-blocking, but…", "minor nit…", "consider…" are incoherent with the workflow.

## What CI has already proven

You're invoked only after the CI workflow passes (TypeScript compiles, the `.vsix` package builds). **Don't second-guess validity.** Don't ask "does this compile?", "does this package?" CI just answered both.

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
