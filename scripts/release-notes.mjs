#!/usr/bin/env node
/**
 * Print the release notes for one version, taken from CHANGELOG.md.
 *
 * Usage:
 *   node scripts/release-notes.mjs v1.0.1            # stdout
 *   node scripts/release-notes.mjs v1.0.1 --out x.md # file
 *
 * The section for `v1.0.1` is the text between `## 1.0.1` and the next `## `
 * heading, so each version keeps its Chinese and English halves together.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const tag = process.argv[2];
if (!tag) {
  console.error('usage: node scripts/release-notes.mjs <tag> [--out <file>]');
  process.exit(1);
}
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > 0 ? process.argv[outIndex + 1] : null;
if (outIndex > 0 && !outFile) {
  console.error('--out needs a file path');
  process.exit(1);
}

const version = tag.replace(/^v/, '');
const changelog = await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8');
const lines = changelog.split(/\r?\n/);

const heading = new RegExp('^##\\s+v?' + version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$');
const start = lines.findIndex((line) => heading.test(line));
if (start < 0) {
  console.error(`CHANGELOG.md has no "## ${version}" section; add one before tagging`);
  process.exit(1);
}

let end = lines.length;
for (let index = start + 1; index < lines.length; index += 1) {
  if (/^##\s+/.test(lines[index])) {
    end = index;
    break;
  }
}

const body = lines.slice(start + 1, end).join('\n').trim() + '\n';
if (outFile) {
  await writeFile(outFile, body, 'utf8');
  console.log('wrote ' + outFile);
} else {
  process.stdout.write(body);
}
