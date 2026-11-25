/**
 * Packaging-metadata checks.
 *
 * The bundle manifest drives installation, so a typo here is only discovered by
 * a user installing the plugin. These checks are cheap and catch the usual
 * suspects: missing files referenced from `files`/`dsh`, invalid locale JSON,
 * and a missing DSH version requirement.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const failures = [];

function readJson(relative) {
  const file = path.join(ROOT, relative);
  if (!fs.existsSync(file)) {
    failures.push('missing file: ' + relative);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push('invalid JSON in ' + relative + ': ' + error.message);
    return null;
  }
}

function requireFile(relative, reason) {
  if (!fs.existsSync(path.join(ROOT, relative))) {
    failures.push('missing ' + relative + ' (' + reason + ')');
  }
}

const pkg = readJson('package.json');
if (pkg) {
  requireFile('client.js', 'browser half');
  requireFile('index.js', 'host half');
  requireFile('README.md', 'readme');
  requireFile('LICENSE', 'license');

  const clientPath = path.join(ROOT, 'client.js');
  if (fs.existsSync(clientPath)) {
    const version = fs.readFileSync(clientPath, 'utf8').match(/const PLUGIN_VERSION = '([^']+)';/);
    if (!version) {
      failures.push('client.js should declare PLUGIN_VERSION for the settings footer');
    } else if (version[1] !== pkg.version) {
      failures.push(
        'client.js PLUGIN_VERSION (' + version[1] + ') should match package.json version (' + pkg.version + ')',
      );
    }
  }

  if (pkg.license !== 'MIT') failures.push('package.json license should be MIT');
  if (pkg.private === true) failures.push('package.json must not be private for a public bundle');
  if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) {
    failures.push('package.json is missing dsh.bundle.patch');
  } else {
    requireFile(pkg.dsh.bundle.patch.replace(/^\.\//, ''), 'bundle patch');
  }
  if (!pkg.dsh || !pkg.dsh.client || !pkg.dsh.client.platform) {
    failures.push('package.json is missing dsh.client.platform');
  }
  if (!pkg.engines || !pkg.engines.dsh) {
    failures.push('package.json should declare engines.dsh so incompatible DSH versions refuse the install');
  }
  if (!Array.isArray(pkg.files) || !pkg.files.includes('docs')) {
    failures.push('package.json files should include "docs" for the plugin detail page');
  }
  if (!pkg.scripts || !pkg.scripts.test) {
    failures.push('package.json should expose a test script');
  }
  for (const entry of Array.isArray(pkg.files) ? pkg.files : []) {
    if (entry.includes('*')) continue;
    if (entry === 'docs') continue; // directory, checked below
    requireFile(entry, 'listed in package.json files');
  }
  requireFile('docs/DETAIL.md', 'English plugin detail document');
  requireFile('docs/DETAIL.zh.md', 'Chinese plugin detail document');
  requireFile('docs/preview.svg', 'plugin detail illustration');
}

for (const locale of ['zh', 'en']) {
  const meta = readJson('locale/' + locale + '.json');
  if (!meta) continue;
  if (!meta.meta || typeof meta.meta.title !== 'string' || typeof meta.meta.description !== 'string') {
    failures.push('locale/' + locale + '.json needs meta.title and meta.description');
    continue;
  }
  if (typeof meta.meta.detail !== 'string') {
    failures.push('locale/' + locale + '.json should declare meta.detail');
  } else {
    requireFile(meta.meta.detail, 'meta.detail of locale/' + locale);
  }
}

if (failures.length > 0) {
  console.error('FAIL: package metadata');
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}

console.log('PASS: package metadata — manifest, locales and detail documents are consistent');
