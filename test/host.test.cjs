/**
 * Host-half checks that need no running DSH.
 *
 * The export route used to accept only POSIX paths and fall back to folders that
 * do not exist on Windows, so every export failed there. The directory
 * resolution is now a pure function, and this file pins its behaviour.
 */
const assert = require('node:assert/strict');
const os = require('node:os');
const fs = require('node:fs');
const { Readable } = require('node:stream');
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

  // End-to-end: one conversation through the real export route into a temp dir.
  const routes = [];
  host.apply({
    effect: (factory) => {
      factory();
    },
    webServer: {
      register: (route) => {
        routes.push(route);
        return () => {};
      },
    },
  });
  assert.equal(routes.length, 1, 'the export route is registered');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-export-'));
  const thread = {
    title: '单条导出',
    updatedAt: 1700000000000,
    pinnedAt: 1700000000500,
    messages: [
      { role: 'user', text: '你好', at: 1700000000001 },
      { role: 'assistant', text: '你好呀', at: 1700000000002 },
    ],
  };
  const request = Readable.from([
    Buffer.from(JSON.stringify({ dir, threads: [thread] }), 'utf8'),
  ]);
  request.method = 'POST';
  request.url = '/chat-replica/export';
  const response = {
    writableEnded: false,
    statusCode: 0,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(payload) {
      this.writableEnded = true;
      this.body = String(payload ?? '');
    },
  };
  await routes[0].handler(request, response);

  assert.equal(response.statusCode, 200, 'the export route answers 200: ' + response.body);
  const result = JSON.parse(response.body);
  assert.equal(result.count, 1, 'one conversation was exported');
  assert.ok(result.path.startsWith(dir), 'the file lands in the requested folder');
  assert.ok(fs.existsSync(result.path), 'the exported file exists');

  const saved = JSON.parse(fs.readFileSync(result.path, 'utf8'));
  assert.equal(saved.threads.length, 1, 'the file holds one conversation');
  assert.equal(saved.threads[0].pinnedAt, 1700000000500, 'the pin state survives the export');
  assert.equal(saved.threads[0].messages[0].at, 1700000000001, 'message timestamps survive the export');
  fs.rmSync(dir, { recursive: true, force: true });

  // The folder shortcuts come from the Host and only list existing directories.
  const pathsResponse = {
    writableEnded: false,
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(payload) {
      this.writableEnded = true;
      this.body = String(payload ?? '');
    },
  };
  const pathsRequest = { method: 'GET', url: '/chat-replica/paths' };
  await routes[0].handler(pathsRequest, pathsResponse);
  assert.equal(pathsResponse.statusCode, 200, 'the paths route answers 200');
  const pathsBody = JSON.parse(pathsResponse.body);
  assert.ok(Array.isArray(pathsBody.dirs), 'the paths route returns a dirs array');
  for (const entry of pathsBody.dirs) {
    assert.ok(fs.existsSync(entry.path), 'a returned shortcut exists: ' + entry.path);
  }

  console.log('PASS: host export directory resolution, single-thread export and folder shortcuts');
}

main().catch((error) => {
  console.error('FAIL: host export directory resolution');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
