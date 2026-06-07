import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    formatBytes,
    sha256,
    NETCOREDBG_VERSION,
    NETCOREDBG_LINUX_AMD64_URL,
    NETCOREDBG_LINUX_AMD64_SHA256,
} from '../src/netcoredbg-installer';

describe('formatBytes', () => {
    it('formats sub-KB sizes as plain bytes', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(512)).toBe('512 B');
        expect(formatBytes(1023)).toBe('1023 B');
    });

    it('switches to KB at 1024', () => {
        expect(formatBytes(1024)).toBe('1.0 KB');
        expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('switches to MB at 1024 * 1024', () => {
        expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
        expect(formatBytes(3_670_016)).toBe('3.5 MB');
    });
});

describe('sha256', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ghul-debug-test-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('matches the well-known empty-input hash', async () => {
        const empty = path.join(tmp, 'empty');
        fs.writeFileSync(empty, '');
        expect(await sha256(empty)).toBe(
            'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
        );
    });

    it('matches the well-known "abc" hash', async () => {
        const file = path.join(tmp, 'abc');
        fs.writeFileSync(file, 'abc');
        expect(await sha256(file)).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        );
    });
});

describe('pinned netcoredbg release constants', () => {
    it('declares a non-empty version string', () => {
        expect(NETCOREDBG_VERSION).toMatch(/\S/);
    });

    it('builds a Samsung netcoredbg release URL that embeds the pinned version', () => {
        expect(NETCOREDBG_LINUX_AMD64_URL).toBe(
            `https://github.com/Samsung/netcoredbg/releases/download/${NETCOREDBG_VERSION}/netcoredbg-linux-amd64.tar.gz`
        );
    });

    it('declares the expected sha256 as 64 lowercase hex characters', () => {
        // Catches typos like a copy-paste with leading whitespace, a
        // hex-with-uppercase mistake, or accidentally pasting the
        // base64-encoded form. The actual byte-level check happens at
        // install time against the downloaded file.
        expect(NETCOREDBG_LINUX_AMD64_SHA256).toMatch(/^[0-9a-f]{64}$/);
    });
});
