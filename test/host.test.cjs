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
  const fakeLlm = {
    listProviders: () => [
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'broken', name: 'Broken' },
    ],
    listModels: async (provider) => {
      if (provider === 'broken') throw new Error('no catalog');
      return [{ id: provider + '-chat', name: 'DeepSeek Chat' }];
    },
    resolveModelInfo: async (provider, model) => {
      if (provider === 'deepseek' && model === 'deepseek-chat') {
        return { provider, id: model, name: 'DeepSeek Chat', context: { contextWindow: 128000 } };
      }
      throw new Error('unknown model');
    },
  };
  const fakeDefaultModel = {
    currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-chat' }),
  };
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
    get: (name) => {
      if (name === 'llm') return fakeLlm;
      if (name === 'agentDefaultModel') return fakeDefaultModel;
      return undefined;
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
      { role: 'assistant', text: '你好呀', at: 1700000000002, usage: { inputTokens: 1000, cacheReadTokens: 200, outputTokens: 356 } },
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
  assert.equal(saved.threads[0].messages[1].usage.outputTokens, 356, 'token usage survives the JSON export');
  assert.equal(saved.threads[0].messages[1].usage.cacheReadTokens, 200, 'cache counters survive the JSON export');

  // The same route can write a Markdown reading copy instead of JSON.
  const markdownRequest = Readable.from([
    Buffer.from(JSON.stringify({ dir, threads: [thread], format: 'markdown' }), 'utf8'),
  ]);
  markdownRequest.method = 'POST';
  markdownRequest.url = '/chat-replica/export';
  const markdownResponse = {
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
  await routes[0].handler(markdownRequest, markdownResponse);
  assert.equal(markdownResponse.statusCode, 200, 'the markdown export answers 200: ' + markdownResponse.body);
  const markdownResult = JSON.parse(markdownResponse.body);
  assert.ok(markdownResult.path.endsWith('.md'), 'the markdown export uses a .md file');
  assert.ok(markdownResult.path.startsWith(dir), 'the markdown file lands beside the JSON one');
  const markdown = fs.readFileSync(markdownResult.path, 'utf8');
  assert.ok(markdown.startsWith('# 单条导出'), 'the markdown starts with the conversation title');
  assert.ok(markdown.includes('## 用户'), 'the markdown has a user section');
  assert.ok(markdown.includes('## 助手'), 'the markdown has an assistant section');
  assert.ok(markdown.includes('你好呀'), 'the markdown keeps the assistant text');
  assert.ok(markdown.includes('用量：'), 'the markdown records token usage');
  assert.ok(markdown.includes('↓ 356'), 'the usage line carries the output count');
  assert.ok(markdown.includes('缓存命中 17%'), 'the usage line carries the cache-hit share');

  // The display-only token estimator mirrors the page heuristic.
  assert.equal(host.estimateTokens('你好'), 2, 'CJK characters count one token each');
  assert.equal(host.estimateTokens('hello'), 2, 'ASCII counts a quarter token per character');
  assert.equal(host.estimateTokens(''), 0, 'empty text has no tokens');

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

  // The model catalog skips providers without a readable catalog.
  const modelsResponse = {
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
  await routes[0].handler({ method: 'GET', url: '/chat-replica/models' }, modelsResponse);
  assert.equal(modelsResponse.statusCode, 200, 'the models route answers 200');
  const catalog = JSON.parse(modelsResponse.body);
  assert.equal(catalog.providers.length, 1, 'only providers with a readable catalog are listed');
  assert.equal(catalog.providers[0].models[0].name, 'DeepSeek Chat', 'model names are listed');
  assert.equal(catalog.current.model, 'deepseek-chat', 'the current selection is reported');
  assert.equal(catalog.current.contextWindow, 128000, 'the current route reports its context window');

  // An explicit selection wins only when the provider knows that model.
  assert.deepEqual(
    await host.resolveRequestSelection(fakeLlm, { provider: 'deepseek', model: 'deepseek-chat' }, { provider: 'x', model: 'y' }),
    { provider: 'deepseek', model: 'deepseek-chat' },
    'a known selection is used',
  );
  assert.deepEqual(
    await host.resolveRequestSelection(fakeLlm, { provider: 'deepseek', model: 'nope' }, { provider: 'x', model: 'y' }),
    { provider: 'x', model: 'y' },
    'an unknown model falls back to the default',
  );
  assert.deepEqual(
    await host.resolveRequestSelection(fakeLlm, null, { provider: 'x', model: 'y' }),
    { provider: 'x', model: 'y' },
    'no selection falls back to the default',
  );

  // The official-format export route writes the page-built archive.
  const officialDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-official-'));
  const officialZip = Buffer.from([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const officialRequest = Readable.from([officialZip]);
  officialRequest.method = 'POST';
  officialRequest.url = '/chat-replica/export-official?dir=' + encodeURIComponent(officialDir);
  const officialResponse = {
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
  await routes[0].handler(officialRequest, officialResponse);
  assert.equal(officialResponse.statusCode, 200, 'the official export answers 200: ' + officialResponse.body);
  const officialResult = JSON.parse(officialResponse.body);
  assert.ok(
    /deepseek_data-\d{4}-\d{2}-\d{2}\.zip$/.test(officialResult.path),
    'the archive is named like the official export',
  );
  assert.ok(fs.existsSync(officialResult.path), 'the official archive is written');
  fs.rmSync(officialDir, { recursive: true, force: true });

  // The update check degrades to `{ ok: false }` on any failure.
  const release = await host.checkLatestRelease(async () => ({
    ok: true,
    json: async () => ({ tag_name: 'v9.9.9', html_url: 'https://example.test/release' }),
  }));
  assert.equal(release.ok, true, 'a reachable release is reported');
  assert.equal(release.version, '9.9.9', 'the v prefix is stripped');
  assert.equal(release.url, 'https://example.test/release', 'the release page URL is passed through');
  assert.deepEqual(
    await host.checkLatestRelease(async () => ({ ok: false })),
    { ok: false },
    'an HTTP failure is reported as a failed check',
  );
  assert.deepEqual(
    await host.checkLatestRelease(async () => {
      throw new Error('offline');
    }),
    { ok: false },
    'a network error is reported as a failed check',
  );

  console.log('PASS: host export directory resolution, single-thread export and folder shortcuts');
}

main().catch((error) => {
  console.error('FAIL: host export directory resolution');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
