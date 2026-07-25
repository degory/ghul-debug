import * as fs from 'fs';
import * as vscode from 'vscode';

import { ensureNetcoredbg } from './netcoredbg-installer';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.debug.registerDebugAdapterDescriptorFactory(
            'ghul',
            new GhulDebugAdapterDescriptorFactory(context)
        )
    );

    context.subscriptions.push(
        vscode.debug.registerDebugConfigurationProvider(
            'ghul',
            new GhulConfigurationProvider()
        )
    );
}

export function deactivate() {}

// Inputs the configuration-resolution logic needs from the surrounding
// vscode environment. Extracted so the logic can be exercised under
// jest without pulling in the real vscode module.
export interface ResolveContext {
    activeLanguageId: string | undefined;
    folderName: string | undefined;
    folderPath: string | undefined;
}

export type ResolveOutcome =
    | { kind: 'ok'; config: vscode.DebugConfiguration }
    | { kind: 'missing-program' };

// Pure transform: takes the launch.json-shaped config the user (or
// VSCode's auto-synthesis fallback) handed us and returns the version
// we want to pass to the debug adapter. The two interesting moves:
//
//   1. If the config looks empty (no type/request/name — F5 in a
//      .ghul file with no launch.json) and the editor + workspace
//      look like a ghul project, fill in a minimal MSBuild-shaped
//      guess so the user gets something rather than a generic
//      "no launch config" error.
//
//   2. Route managed-assembly launches through `dotnet` so
//      netcoredbg handles `.exe` and `.dll` uniformly. Without
//      this, netcoredbg silently E_FAILs on `.exe` paths even
//      though .NET-Framework-style .exe and modern .dll managed
//      assemblies are byte-for-byte identical PE32 files.
export function resolveGhulDebugConfiguration(
    config: Partial<vscode.DebugConfiguration>,
    context: ResolveContext
): ResolveOutcome {
    if (!config.type && !config.request && !config.name) {
        if (
            context.activeLanguageId === 'ghul' &&
            context.folderName &&
            context.folderPath
        ) {
            config.type = 'ghul';
            config.request = 'launch';
            config.name = 'ghūl: launch (auto)';
            config.program = `${context.folderPath}/bin/Debug/net10.0/${context.folderName}.dll`;
            config.cwd = context.folderPath;
            config.console = 'internalConsole';
        }
    }

    if (!config.program) {
        return { kind: 'missing-program' };
    }

    if (typeof config.program === 'string' && /\.(exe|dll)$/i.test(config.program)) {
        const assemblyPath = config.program;
        config.program = 'dotnet';
        config.args = [assemblyPath, ...((config.args as string[] | undefined) ?? [])];
    }

    // Either the auto-synthesis branch above supplied type/request/name, or
    // they came from a launch.json entry VSCode had already validated.
    return { kind: 'ok', config: config as vscode.DebugConfiguration };
}

class GhulConfigurationProvider implements vscode.DebugConfigurationProvider {
    resolveDebugConfiguration(
        folder: vscode.WorkspaceFolder | undefined,
        config: vscode.DebugConfiguration,
        _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {
        const editor = vscode.window.activeTextEditor;
        const outcome = resolveGhulDebugConfiguration(config, {
            activeLanguageId: editor?.document.languageId,
            folderName: folder?.name,
            folderPath: folder?.uri.fsPath,
        });

        if (outcome.kind === 'missing-program') {
            return vscode.window.showErrorMessage(
                'ghūl debug: `program` is required — path to the compiled managed assembly.'
            ).then(_ => undefined);
        }

        return outcome.config;
    }
}

class GhulDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
    constructor(private readonly context: vscode.ExtensionContext) {}

    async createDebugAdapterDescriptor(
        _session: vscode.DebugSession,
        _executable: vscode.DebugAdapterExecutable | undefined
    ): Promise<vscode.DebugAdapterDescriptor | undefined> {
        const ncdbgPath = await this.findNetcoredbg();

        if (!ncdbgPath) {
            vscode.window.showErrorMessage(
                'ghūl debug: could not locate netcoredbg. Set `ghul.debug.netcoredbgPath` to its full path, ' +
                'put `netcoredbg` on $PATH, or install a supported platform release from ' +
                'https://github.com/Samsung/netcoredbg/releases'
            );
            return undefined;
        }

        return new vscode.DebugAdapterExecutable(ncdbgPath, ['--interpreter=vscode']);
    }

    private async findNetcoredbg(): Promise<string | undefined> {
        // Explicit user setting wins — corporate proxies, offline
        // workflows, or testing a custom build all need this.
        const configured = vscode.workspace
            .getConfiguration('ghul.debug')
            .get<string>('netcoredbgPath');

        if (configured && configured.length > 0) {
            if (fs.existsSync(configured)) {
                return configured;
            }
            vscode.window.showWarningMessage(
                `ghūl debug: ghul.debug.netcoredbgPath="${configured}" does not exist; falling back.`
            );
        }

        // Cached / auto-installed build under the extension's
        // globalStorage. First call on a fresh install downloads;
        // subsequent calls are an existsSync. Returns undefined on
        // unsupported platforms (anything other than linux-amd64
        // today) or download failure.
        const auto = await ensureNetcoredbg(this.context);
        if (auto) {
            return auto;
        }

        // Final fallback: let the OS resolve via $PATH. Spawning
        // `netcoredbg` will fail later if the user doesn't have one
        // installed; the error from VSCode's adapter launch surfaces
        // the missing binary.
        return 'netcoredbg';
    }
}
