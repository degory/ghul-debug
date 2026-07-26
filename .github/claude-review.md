# Cloud code review brief

What this repository is, and what to watch for in it. Everything else — what PR
context is available, how to post a review, what makes a finding worth raising,
comment hygiene, PR-description shape, the versioning mechanism — comes from the
review workflow's runtime notes. Don't restate it here: this file is read first,
so a stale copy would silently override the current text.

Not loaded by local Claude Code; only the cloud reviewer reads this.

## What this repo is

`ghul-debug` is the ghūl debug adapter: a TypeScript implementation of the Debug
Adapter Protocol that lets VS Code step through ghūl programs. It sits between the
editor and the .NET debugger, translating DAP requests and mapping IL positions
back to ghūl source.

A fault here shows up as a debugger that attaches but lies - breakpoints on the
wrong line, variables reading as the wrong values - which is harder to notice than
one that fails outright.

## What to watch for here

- Source-position mapping between IL and ghūl source. An off-by-one lands a
  breakpoint on the wrong line and looks like a compiler bug.
- DAP conformance: missing or malformed responses, requests answered out of order,
  capabilities advertised but not implemented.
- Process lifecycle - a debuggee left running after detach, or an adapter that
  does not terminate cleanly, strands processes on the user's machine.
- Unhandled rejections on the adapter message path, which present as the debugger
  hanging rather than erroring.

## Versioning

Major means a change requiring a VS Code or compiler version users do not yet
have, or an incompatible change to how the adapter is launched or configured;
minor means new DAP capabilities or configuration options.
