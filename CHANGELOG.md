# Changelog

## 0.1.0

Initial release.

- Registers a `ghul` debug type backed by netcoredbg.
- Auto-downloads netcoredbg on first debug session (linux-amd64 only for now;
  other platforms fall back to `ghul.debug.netcoredbgPath` or `$PATH`).
- Transparently routes both `.exe` and `.dll` managed-assembly launches
  through `dotnet`, so the file extension ghūl emits doesn't matter.
- Configuration provider synthesises a default launch config when F5 is hit
  with no `launch.json`.
