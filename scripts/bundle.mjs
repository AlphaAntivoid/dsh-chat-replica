#!/usr/bin/env node
/**
 * Build the installable bundle tarball the DSH Plugin Manager expects: a gzip
 * archive whose root is one folder holding the runtime files, the bundle patch,
 * the icon, the docs and the licenses.
 *
 * Usage: npm run bundle   → dist/dsh-chat-replica-<version>.tar.gz
 */
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const STAGE = join(DIST, 'dsh-chat-replica');
const ENTRIES = [
  'client.js',
  'index.js',
  'package.json',
  'cordis.patch.yml',
  'icon.svg',
  'README.md',
  'README.en.md',
  'LICENSE',
  'locale',
  'docs',
];

const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
const archive = join(DIST, `dsh-chat-replica-${pkg.version}.tar.gz`);

await rm(DIST, { recursive: true, force: true });
await mkdir(STAGE, { recursive: true });
for (const entry of ENTRIES) {
  await cp(join(ROOT, entry), join(STAGE, entry), { recursive: true });
}
execFileSync('tar', ['-czf', archive, '-C', DIST, 'dsh-chat-replica'], { stdio: 'inherit' });
console.log(archive);
