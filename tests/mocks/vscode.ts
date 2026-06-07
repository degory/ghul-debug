// Minimal stub of the `vscode` module so the extension source compiles
// and runs under jest. Only the surface actually referenced from the
// source under test needs to exist here — anything else can be added
// when a new test needs it.

export const window = {
    activeTextEditor: undefined as unknown,
    showErrorMessage: (_message: string) =>
        Promise.resolve(undefined as string | undefined),
    showWarningMessage: (_message: string) =>
        Promise.resolve(undefined as string | undefined),
    withProgress: <T>(_options: unknown, task: (...args: unknown[]) => Promise<T>) =>
        task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }),
};

export const workspace = {
    getConfiguration: (_section?: string) => ({
        get: <T>(_key: string): T | undefined => undefined,
    }),
};

export const debug = {
    registerDebugAdapterDescriptorFactory: (_type: string, _factory: unknown) => ({
        dispose: () => {},
    }),
    registerDebugConfigurationProvider: (_type: string, _provider: unknown) => ({
        dispose: () => {},
    }),
};

export class DebugAdapterExecutable {
    constructor(public command: string, public args?: string[]) {}
}

export const ProgressLocation = {
    Notification: 15,
};

// Types-only re-exports the source uses purely as type annotations.
// jest never evaluates them at runtime, so empty placeholders suffice.
export type ExtensionContext = {
    subscriptions: { dispose: () => void }[];
    globalStorageUri: { fsPath: string };
};
export type WorkspaceFolder = { name: string; uri: { fsPath: string } };
export type DebugConfiguration = Record<string, unknown> & {
    type?: string;
    request?: string;
    name?: string;
    program?: unknown;
    args?: unknown;
    cwd?: unknown;
    console?: unknown;
};
export type CancellationToken = {
    isCancellationRequested: boolean;
    onCancellationRequested: (cb: () => void) => { dispose: () => void };
};
export type ProviderResult<T> = T | undefined | Promise<T | undefined>;
export type DebugConfigurationProvider = unknown;
export type DebugAdapterDescriptorFactory = unknown;
export type DebugSession = unknown;
export type DebugAdapterDescriptor = unknown;
export type Progress<T> = { report: (value: T) => void };
