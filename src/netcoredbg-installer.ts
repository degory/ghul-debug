import * as cp from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';

// Pinned netcoredbg release. Bumping these two lines + recomputing
// the sha is the entirety of a version bump.
export const NETCOREDBG_VERSION = '3.1.3-1062';
export const NETCOREDBG_LINUX_AMD64_URL =
    `https://github.com/Samsung/netcoredbg/releases/download/${NETCOREDBG_VERSION}/netcoredbg-linux-amd64.tar.gz`;
export const NETCOREDBG_LINUX_AMD64_SHA256 =
    '3814341c028c81ff7eea03ac316ad92e9ad7d705d2a00e3e3df269cdc241c763';

// Try to make a usable netcoredbg available, downloading it once on
// first use if it isn't already cached. Returns the path to the
// binary, or undefined if the auto-install path can't deliver — in
// which case the caller falls back to `ghul.debug.netcoredbgPath` /
// `$PATH`. All failure modes (unsupported platform, network error,
// TLS failure, hash mismatch, extraction failure) come back here as
// `undefined` plus a one-line warning notification; nothing throws.
export async function ensureNetcoredbg(
    context: vscode.ExtensionContext
): Promise<string | undefined> {
    const cacheDir = path.join(
        context.globalStorageUri.fsPath,
        'netcoredbg',
        NETCOREDBG_VERSION
    );
    const binaryPath = path.join(cacheDir, 'netcoredbg');

    // Cache hit — happy path on every call after the first.
    if (fs.existsSync(binaryPath)) {
        return binaryPath;
    }

    // Auto-install is linux-amd64 only for now. Other platforms fall
    // back silently to the manual-install path; the caller will
    // surface an error if that fails too.
    if (process.platform !== 'linux' || process.arch !== 'x64') {
        return undefined;
    }

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `ghūl debug: downloading netcoredbg ${NETCOREDBG_VERSION}`,
            cancellable: true,
        },
        async (progress, token) => {
            const tarballPath = path.join(
                context.globalStorageUri.fsPath,
                'netcoredbg',
                `${NETCOREDBG_VERSION}.tar.gz`
            );

            try {
                await fs.promises.mkdir(path.dirname(tarballPath), { recursive: true });

                progress.report({ message: 'connecting…' });
                await download(NETCOREDBG_LINUX_AMD64_URL, tarballPath, progress, token);

                if (token.isCancellationRequested) {
                    return undefined;
                }

                progress.report({ message: 'verifying…' });
                const actual = await sha256(tarballPath);
                if (actual !== NETCOREDBG_LINUX_AMD64_SHA256) {
                    throw new Error(
                        `sha256 mismatch (expected ${NETCOREDBG_LINUX_AMD64_SHA256}, got ${actual})`
                    );
                }

                progress.report({ message: 'extracting…' });
                await fs.promises.mkdir(cacheDir, { recursive: true });
                await extractTarball(tarballPath, cacheDir);

                await fs.promises.chmod(binaryPath, 0o755);

                await fs.promises.unlink(tarballPath).catch(() => {});

                return binaryPath;
            } catch (e) {
                await fs.promises.unlink(tarballPath).catch(() => {});
                const message = e instanceof Error ? e.message : String(e);
                vscode.window.showWarningMessage(
                    `ghūl debug: netcoredbg download failed (${message}). ` +
                    `Set \`ghul.debug.netcoredbgPath\` to a manually-installed binary, ` +
                    `or put \`netcoredbg\` on $PATH.`
                );
                return undefined;
            }
        }
    );
}

function download(
    url: string,
    destination: string,
    progress: vscode.Progress<{ increment?: number; message?: string }>,
    token: vscode.CancellationToken
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let request: ReturnType<typeof https.get> | undefined;
        let output: fs.WriteStream | undefined;

        const cancel = () => {
            request?.destroy();
            output?.close();
            fs.promises.unlink(destination).catch(() => {});
            reject(new Error('cancelled by user'));
        };

        const subscription = token.onCancellationRequested(cancel);

        const open = (currentUrl: string, redirectsLeft: number) => {
            request = https.get(currentUrl, (response) => {
                const status = response.statusCode ?? 0;

                if ((status === 301 || status === 302 || status === 307 || status === 308) && response.headers.location) {
                    if (redirectsLeft <= 0) {
                        subscription.dispose();
                        reject(new Error('too many redirects'));
                        return;
                    }
                    response.resume();
                    open(response.headers.location, redirectsLeft - 1);
                    return;
                }

                if (status !== 200) {
                    subscription.dispose();
                    reject(new Error(`HTTP ${status}`));
                    return;
                }

                const total = parseInt(response.headers['content-length'] ?? '0', 10);
                let received = 0;

                output = fs.createWriteStream(destination);

                response.on('data', (chunk: Buffer) => {
                    received += chunk.length;
                    if (total > 0) {
                        const percent = Math.round((received / total) * 100);
                        progress.report({
                            increment: (chunk.length / total) * 100,
                            message: `${percent}% (${formatBytes(received)} / ${formatBytes(total)})`,
                        });
                    } else {
                        progress.report({ message: formatBytes(received) });
                    }
                });

                response.pipe(output);
                output.on('finish', () => {
                    subscription.dispose();
                    resolve();
                });
                output.on('error', (err) => {
                    subscription.dispose();
                    reject(err);
                });
            });

            request.on('error', (err) => {
                subscription.dispose();
                reject(err);
            });
        };

        open(url, 5);
    });
}

export async function sha256(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    for await (const chunk of stream) {
        hash.update(chunk as Buffer);
    }
    return hash.digest('hex');
}

function extractTarball(archive: string, destination: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const tar = cp.spawn(
            'tar',
            ['-xzf', archive, '--strip-components=1', '-C', destination],
            { stdio: ['ignore', 'pipe', 'pipe'] }
        );

        let stderr = '';
        tar.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });

        tar.on('error', reject);
        tar.on('exit', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`tar exited ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
            }
        });
    });
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
