# ghūl debugger

Source-level debugger for the [ghūl](https://ghul.dev) language in VS Code, via [netcoredbg](https://github.com/Samsung/netcoredbg).

Pairs with the [`ghul` language extension](https://marketplace.visualstudio.com/items?itemName=degory.ghul) (which provides syntax, hover, completion, diagnostics). Install both for the full experience.

## What you get

- Breakpoints in `.ghul` source files.
- Step over / into / out at statement granularity.
- Locals pane with the program's variables (using their generated names — `name.0`, `name.1`, etc.).
- Call stack resolving to `.ghul` source.
- Exception stops with file + line attribution.

## Status

Early prototype. Some constructs don't yet have sequence points and will silently slide to the next breakpoint-able line. Async stepping into spilled `await` works but lacks proper state-machine reconstruction. Watch-pane expressions are evaluated by netcoredbg in C# syntax — ghūl-specific syntax (`isa`, `let`, `|`) won't parse there.

## Install

1. Install this extension from the VS Code Marketplace (once published) or from a `.vsix` build artifact.
2. On first debug session:
   - **linux-amd64**: the extension downloads a pinned [netcoredbg](https://github.com/Samsung/netcoredbg/releases) release (~3.5 MB compressed) into its extension storage. A progress notification shows the download; subsequent debug sessions reuse the cached copy.
   - **Other platforms**: install netcoredbg manually, then either add it to `$PATH` or set `ghul.debug.netcoredbgPath` to the full path of the executable.
3. The `ghul.debug.netcoredbgPath` setting always takes precedence — useful behind a corporate proxy, on an offline machine, or to test a custom build.

## Use

1. Compile your ghūl program with `--debug` to get a PDB alongside the assembly. The compiler emits a managed assembly (`.exe` or `.dll`, the extension's choice — they're the same PE32 file) plus a `.pdb` (Portable PDB with sequence points). The extension launches both forms via `dotnet`, so either works.
2. Create `.vscode/launch.json` with a `ghul`-type config:

   ```json
   {
       "version": "0.2.0",
       "configurations": [
           {
               "name": "ghūl: launch",
               "type": "ghul",
               "request": "launch",
               "program": "${workspaceFolder}/bin/Debug/net10.0/myapp.dll",
               "cwd": "${workspaceFolder}",
               "console": "internalConsole",
               "stopAtEntry": false,
               "justMyCode": false
           }
       ]
   }
   ```

   Or click "create a launch.json" in the Run-and-Debug sidebar and pick "ghūl (netcoredbg)".

3. Open a `.ghul` file, set a breakpoint, hit F5.

## Configuration

| Setting | Default | Purpose |
|---|---|---|
| `ghul.debug.netcoredbgPath` | `""` | Full path to the netcoredbg executable. Leave blank to use `netcoredbg` from `$PATH`. |

Launch attributes per config:

| Attribute | Default | Purpose |
|---|---|---|
| `program` | (required) | Path to the `.dll` to launch. |
| `args` | `[]` | Command-line arguments. |
| `cwd` | `${workspaceFolder}` | Working directory for the launched program. |
| `env` | `{}` | Environment variables. |
| `stopAtEntry` | `false` | Stop on entry to the program's entry point. |
| `justMyCode` | `false` | Step only through user code, skipping framework. |
| `console` | `"internalConsole"` | Where stdin/stdout/stderr go. |

## Why netcoredbg?

VS Code's bundled debugger (`vsdbg`, distributed with the official C# extension) enforces a licence restriction that prevents non-Microsoft extensions from invoking it. netcoredbg is Samsung's MIT-licensed re-implementation of the DAP server for .NET; it does the same job and can be freely redistributed and invoked.

## Building from source

```sh
npm install
npm run compile
npx @vscode/vsce package
```

Produces `ghul-debug-<version>.vsix`. Install with `code --install-extension ghul-debug-<version>.vsix`.

## License

GPL-3.0. See [LICENSE](./LICENSE).

## Issues

[View open issues](https://github.com/degory/ghul/issues?q=is%3Aopen+is%3Aissue+label%3Aghul-debug) or [raise a new one](https://github.com/degory/ghul/issues/new?labels=ghul-debug).
