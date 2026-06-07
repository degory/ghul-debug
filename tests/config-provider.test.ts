import {
    resolveGhulDebugConfiguration,
    ResolveContext,
} from '../src/extension';

const noContext: ResolveContext = {
    activeLanguageId: undefined,
    folderName: undefined,
    folderPath: undefined,
};

const ghulProject: ResolveContext = {
    activeLanguageId: 'ghul',
    folderName: 'myapp',
    folderPath: '/home/u/proj/myapp',
};

describe('resolveGhulDebugConfiguration', () => {
    describe('auto-synthesis on empty config', () => {
        it('fills in a minimal launch config when a ghul file is active in a workspace', () => {
            const outcome = resolveGhulDebugConfiguration({}, ghulProject);

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.type).toBe('ghul');
            expect(outcome.config.request).toBe('launch');
            expect(outcome.config.name).toBe('ghūl: launch (auto)');
            expect(outcome.config.cwd).toBe('/home/u/proj/myapp');
            expect(outcome.config.console).toBe('internalConsole');
        });

        it('reports missing-program when no ghul file is active and program was not supplied', () => {
            const outcome = resolveGhulDebugConfiguration({}, noContext);
            expect(outcome.kind).toBe('missing-program');
        });

        it('reports missing-program when active language is not ghul', () => {
            const outcome = resolveGhulDebugConfiguration({}, {
                ...ghulProject,
                activeLanguageId: 'csharp',
            });
            expect(outcome.kind).toBe('missing-program');
        });

        it('does not overwrite a non-empty config with the auto-synthesis guess', () => {
            const config = {
                type: 'ghul',
                request: 'launch',
                name: 'custom',
                program: '/explicit/path.dll',
            };
            const outcome = resolveGhulDebugConfiguration(config, ghulProject);

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.name).toBe('custom');
            // program gets wrapped through dotnet — see separate test below
            expect(outcome.config.args).toEqual(['/explicit/path.dll']);
        });
    });

    describe('dotnet wrapping for managed assemblies', () => {
        it('routes .dll launches through `dotnet` with the assembly as the first arg', () => {
            const outcome = resolveGhulDebugConfiguration(
                { type: 'ghul', request: 'launch', name: 'x', program: '/p/bin/app.dll' },
                noContext
            );

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('dotnet');
            expect(outcome.config.args).toEqual(['/p/bin/app.dll']);
        });

        it('routes .exe launches through `dotnet` (compiler may emit either extension)', () => {
            const outcome = resolveGhulDebugConfiguration(
                { type: 'ghul', request: 'launch', name: 'x', program: '/p/bin/app.exe' },
                noContext
            );

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('dotnet');
            expect(outcome.config.args).toEqual(['/p/bin/app.exe']);
        });

        it('preserves existing args ahead-of-which the assembly path is inserted', () => {
            const outcome = resolveGhulDebugConfiguration(
                {
                    type: 'ghul',
                    request: 'launch',
                    name: 'x',
                    program: '/p/bin/app.dll',
                    args: ['--flag', 'value'],
                },
                noContext
            );

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.args).toEqual(['/p/bin/app.dll', '--flag', 'value']);
        });

        it('matches dll/exe case-insensitively', () => {
            const outcome = resolveGhulDebugConfiguration(
                { type: 'ghul', request: 'launch', name: 'x', program: '/p/bin/APP.DLL' },
                noContext
            );

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('dotnet');
            expect(outcome.config.args).toEqual(['/p/bin/APP.DLL']);
        });

        it('leaves a program that is not a managed-assembly path alone', () => {
            const outcome = resolveGhulDebugConfiguration(
                { type: 'ghul', request: 'launch', name: 'x', program: '/usr/bin/somebinary' },
                noContext
            );

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('/usr/bin/somebinary');
            expect(outcome.config.args).toBeUndefined();
        });

        it('is idempotent: a config that already routes through dotnet is left alone on re-entry', () => {
            const config = {
                type: 'ghul',
                request: 'launch',
                name: 'x',
                program: 'dotnet',
                args: ['/p/bin/app.dll'],
            };
            const outcome = resolveGhulDebugConfiguration(config, noContext);

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('dotnet');
            expect(outcome.config.args).toEqual(['/p/bin/app.dll']);
        });

        it('wraps the auto-synthesised .dll path through dotnet in a single pass', () => {
            const outcome = resolveGhulDebugConfiguration({}, ghulProject);

            expect(outcome.kind).toBe('ok');
            if (outcome.kind !== 'ok') return;

            expect(outcome.config.program).toBe('dotnet');
            expect(outcome.config.args).toEqual([
                '/home/u/proj/myapp/bin/Debug/net10.0/myapp.dll',
            ]);
        });
    });
});
