/**
 * Host-half checks that need no running DSH.
 *
 * The export route used to accept only POSIX paths and fall back to folders that
 * do not exist on Windows, so every export failed there. The directory
 * resolution is now a pure function, and this file pins its behaviour.
 */
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const existsIn = (set) => (dir) => set.includes(dir);

async function main() {
  const host = await import('../index.js');
  assert.equal(typeof host.apply, 'function', 'the Host half still exports apply()');
  assert.equal(typeof host.exportCandidates, 'function', 'exportCandidates is exported');

  // An existing absolute directory requested by the page wins.
  const requested = path.resolve(path.sep + 'tmp', 'dsh-export');
  assert.equal(
    host.exportCandidates(requested, existsIn([requested]))[0],
    requested,
    'an existing requested folder is used first',
  );

  // A missing (or stale) requested directory is skipped, never created blindly.
  const missing = host.exportCandidates(requested, existsIn([]));
  assert.ok(!missing.includes(requested), 'a missing requested folder is skipped');
  assert.ok(
    missing.includes(path.join(os.homedir(), 'Downloads')),
    'the platform Downloads folder is a fallback',
  );

  // An empty request means "let the Host choose".
  const auto = host.exportCandidates('', existsIn([]));
  assert.ok(!auto.includes(''), 'an empty request never becomes a directory');
  assert.ok(auto.length >= 2, 'there are fallbacks to try');

  // The Android layout participates only where it really exists.
  const android = host.exportCandidates('', existsIn(['/sdcard/Download']));
  assert.equal(android[0], '/sdcard/Download', 'the Android download folder leads where it exists');

  // Windows drive paths must be honoured on win32.
  if (process.platform === 'win32') {
    const windows = 'C:\\Users\\dsh\\Downloads';
    assert.equal(
      host.exportCandidates(windows, existsIn([windows]))[0],
      windows,
      'Windows drive paths are honoured',
    );
  }

  console.log('PASS: host export directory resolution');
}

main().catch((error) => {
  console.error('FAIL: host export directory resolution');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
