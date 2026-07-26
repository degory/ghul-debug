# Cloud code review brief

What this repository is, and what to watch for in it. Everything else — what PR
context is available, how to post a review, what makes a finding worth raising,
comment hygiene, PR-description shape, the versioning mechanism — comes from the
review workflow's runtime notes. Don't restate it here: this file is read first,
so a stale copy would silently override the current text.

Not loaded by local Claude Code; only the cloud reviewer reads this.

## What this repo is

`ghul-debug` is the ghūl VS Code debugging extension. It does not implement a
debug adapter: it registers a descriptor factory and a `DebugConfigurationProvider`
for the `ghul` debug type, and defers the actual debugging to Samsung's
`netcoredbg`. Two TypeScript files, `src/extension.ts` and
`src/netcoredbg-installer.ts`.

The installer fetches a pinned `netcoredbg` release over HTTPS, verifies it against
a hard-coded SHA-256, caches it under the extension's global storage, and returns
`undefined` on any failure so the caller falls back to the user's
`ghul.debug.netcoredbgPath` or `$PATH`. Auto-install is linux-amd64 only; every
other platform takes that fallback.

## What to watch for here

- **The pinned release and its hash.** `NETCOREDBG_VERSION` and
  `NETCOREDBG_LINUX_AMD64_SHA256` must move together — a version bump without a
  recomputed hash turns every first-time install into a hash mismatch, and a hash
  weakened or skipped makes this a supply-chain path for anyone who can serve that
  URL. Treat the verification step as security-relevant, not as a nicety.
- **The no-throw contract.** `ensureNetcoredbg` promises that every failure mode —
  unsupported platform, network error, TLS failure, hash mismatch, extraction
  failure — returns `undefined` with a warning rather than throwing. A new code path
  that can throw breaks activation for users whose fallback would have worked.
- **Launch-configuration resolution.** `resolveGhulDebugConfiguration` is where a
  malformed or incomplete config should be rejected with something a user can act
  on. Its result shape is a discriminated union; a new failure that returns `ok`
  with a half-populated config surfaces later as an opaque debugger error.
- **Platform assumptions.** The linux-amd64 guard is explicit today. Anything that
  assumes the auto-install path succeeded, or that a cached binary exists, needs to
  hold on macOS and Windows where it never runs.
- **`package.json` contributions** — `breakpoints`, the `ghul` debugger type, and
  `ghul.debug.netcoredbgPath` — drifting from what the resolver and installer
  actually read.

## Versioning

This section is the only authority on what breaking means here, since the runtime
notes defer to it. The user-visible surface is the `ghul` debug type and its launch
configuration schema, the `ghul.debug.netcoredbgPath` setting, and which
`netcoredbg` version gets installed.

Major means breaking any of those: a removed or renamed configuration property, a
changed debug type, or a `netcoredbg` bump that requires a runtime users do not
have. Minor means additions — new configuration properties, new platforms gaining
auto-install. A `netcoredbg` patch bump with its hash recomputed is a patch here.
