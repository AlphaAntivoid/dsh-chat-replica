/**
 * Host half of the DeepSeek chat replica bundle.
 *
 * Two same-origin routes back the page in `client.js`:
 *
 *   POST /chat-replica/chat        NDJSON stream of one model call
 *   POST /chat-replica/transcribe  16 kHz mono PCM16 WAV in, text out
 *
 * The model route uses the profile's own default model selection, so the page
 * talks to the same provider the Agent does and needs no API key of its own.
 * The transcription route prefers the profile's `speechToText` provider and
 * falls back to the Android App's local `/device/asr` bridge (the same engine
 * the app's own voice button uses), so it also works in profiles where the
 * speech registry is not mounted.
 */

import { request as httpRequest } from 'node:http';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { appendFileSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const SYSTEM_PROMPT = [
  '你是 DeepSeek，一个乐于助人的 AI 助手。',
  '用简体中文回答，除非用户使用其他语言。',
  '回答简洁、准确，可以使用 Markdown（段落、列表、行内代码、代码块）。',
].join('\n');

const ROUTE_PREFIX = '/chat-replica';
const MAX_CHAT_BODY = 4 * 1024 * 1024;
const MAX_AUDIO_BODY = 8 * 1024 * 1024;

/** Only the Web profile has an HTTP carrier, so stay inactive elsewhere. */
export const inject = ['webServer'];

/**
 * Register the replica's HTTP routes.
 * @param ctx - Host plugin context carrying `webServer`.
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: (req, res) =>
          handle(req, res, ctx).catch((error) => {
            try {
              sendJson(res, 500, { error: 'internal', message: messageOf(error) });
            } catch {
              /* the response is already committed; nothing left to report on */
            }
            if (!res.writableEnded) {
              try {
                res.end();
              } catch {
                /* the socket is gone */
              }
            }
          }),
      }),
    'deepseek-chat-ui: http routes',
  );
}

/* ---------------------------------------------------------------- routing */

async function handle(req, res, ctx) {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (url.pathname === `${ROUTE_PREFIX}/health`) {
    sendJson(res, 200, await health(ctx));
    return;
  }
  if (url.pathname === `${ROUTE_PREFIX}/chat`) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    await chatStream(req, res, ctx);
    return;
  }
  if (url.pathname === `${ROUTE_PREFIX}/tts`) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    await speak(req, res, ctx);
    return;
  }
  if (url.pathname === `${ROUTE_PREFIX}/system-theme`) {
    sendJson(res, 200, { scheme: await readSystemScheme() });
    return;
  }
  if (url.pathname === `${ROUTE_PREFIX}/export`) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    await exportConversations(req, res);
    return;
  }
  if (url.pathname === `${ROUTE_PREFIX}/transcribe`) {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method' });
    await transcribe(req, res, ctx, url);
    return;
  }
  sendJson(res, 404, { error: 'not-found' });
}

async function health(ctx) {
  const selection = readSelection(ctx);
  const speech = ctx.get('speechToText');
  const bridge = bridgeConfig();
  const llm = ctx.get('llm');
  let reasoning = null;
  if (llm !== undefined && selection !== undefined) {
    try {
      const info = await llm.resolveModelInfo(selection.provider, selection.model);
      if (info?.reasoning) {
        reasoning = {
          efforts: (info.reasoning.efforts ?? []).map((effort) => effort.id),
          defaultEffort: info.reasoning.defaultEffort ?? null,
        };
      }
    } catch {
      reasoning = null;
    }
  }
  return {
    ok: true,
    model: selection === undefined ? null : { provider: selection.provider, model: selection.model },
    reasoning,
    selectedEffort: selection?.reasoningEffort ?? null,
    search: ctx.get('web') !== undefined,
    speech:
      (speech === undefined ? false : speech.snapshot().providers.length > 0) ||
      (bridge.token !== '' && bridge.port !== 0),
  };
}

/* ------------------------------------------------------------------- chat */

async function chatStream(req, res, ctx) {
  const llm = ctx.get('llm');
  if (llm === undefined) return sendJson(res, 503, { error: 'llm-unavailable' });
  const selection = readSelection(ctx);
  if (selection === undefined) return sendJson(res, 503, { error: 'model-unavailable' });

  let payload;
  try {
    payload = JSON.parse((await readBody(req, MAX_CHAT_BODY)).toString('utf8') || '{}');
  } catch (error) {
    return sendJson(res, 400, { error: 'bad-json', message: messageOf(error) });
  }

  const messages = toRequestMessages(payload.messages, selection.provider, selection.model);
  if (messages.length === 0) return sendJson(res, 400, { error: 'empty' });

  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    'x-accel-buffering': 'no',
  });

  const abort = new AbortController();
  const onClose = () => abort.abort();
  res.on('close', onClose);
  const write = (frame) => {
    if (res.writableEnded) return;
    try {
      res.write(`${JSON.stringify(frame)}\n`);
    } catch {
      /* the peer is gone; the abort below unwinds the model stream */
    }
  };

  const thinking = payload.thinking === true;
  const wantsSearch = payload.search === true;
  let searchContext = '';
  if (wantsSearch) {
    write({ type: 'search', phase: 'start' });
    searchContext = await runSearch(ctx, payload, write, abort.signal);
  }

  const reasoning = await modelReasoning(llm, selection.provider, selection.model);
  const effort = pickEffort(reasoning, selection, thinking);

  const options = {
    provider: selection.provider,
    model: selection.model,
    messages,
    system: searchContext === '' ? SYSTEM_PROMPT : `${SYSTEM_PROMPT}\n\n${searchContext}`,
    signal: abort.signal,
    ...(effort === undefined ? {} : { reasoningEffort: effort }),
  };

  try {
    for await (const chunk of llm.stream(options)) {
      if (chunk.type === 'text-delta') write({ type: 'text', text: chunk.text });
      else if (chunk.type === 'reasoning-delta') write({ type: 'reasoning', text: chunk.text });
      else if (chunk.type === 'usage') write({ type: 'usage', usage: chunk.usage });
      else if (chunk.type === 'finish') {
        if (chunk.reason.kind === 'error') {
          write({ type: 'error', code: chunk.reason.failure.code, message: chunk.reason.failure.message });
        }
        write({ type: 'done', reason: chunk.reason.kind });
      }
    }
  } catch (error) {
    write({ type: 'error', code: 'failed', message: messageOf(error) });
    write({ type: 'done', reason: 'error' });
  } finally {
    res.off('close', onClose);
    if (!res.writableEnded) res.end();
  }
}

/**
 * Convert the page's `{role, text}` list into request messages.
 * Assistant turns need a model source because they replay provider history.
 */
function toRequestMessages(list, provider, model) {
  const out = [];
  let seq = 0;
  for (const item of Array.isArray(list) ? list : []) {
    const text = typeof item?.text === 'string' ? item.text : '';
    if (text.trim().length === 0) continue;
    if (item?.role === 'assistant') {
      seq += 1;
      out.push({
        role: 'assistant',
        id: `replica-${Date.now().toString(36)}-${seq}`,
        source: { kind: 'model', provider, model },
        content: [{ type: 'text', text }],
      });
    } else {
      out.push({ role: 'user', content: [{ type: 'text', text }] });
    }
  }
  return out;
}

function readSelection(ctx) {
  const service = ctx.get('agentDefaultModel');
  if (service === undefined) return undefined;
  try {
    const selection = service.currentSelection();
    if (selection === undefined || selection === null) return undefined;
    if (typeof selection.provider !== 'string' || typeof selection.model !== 'string') return undefined;
    return selection;
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------- transcribe */

async function transcribe(req, res, ctx, url) {
  const audio = await readBody(req, MAX_AUDIO_BODY);
  if (audio.length < 64) return sendJson(res, 400, { error: 'audio-too-short' });
  const language = url.searchParams.get('lang') ?? 'zh';
  const speech = ctx.get('speechToText');
  if (speech !== undefined) {
    try {
      const spec = speech.resolve({ audio: new Uint8Array(audio), language });
      const result = await speech.transcribe(spec, new AbortController().signal);
      return sendJson(res, 200, { text: result?.text ?? '' });
    } catch (error) {
      /* fall through to the App bridge: both are the same on-device engine */
    }
  }
  try {
    const result = await bridgeTranscribe(audio, language);
    sendJson(res, 200, { text: result.text, source: 'device-bridge' });
  } catch (error) {
    sendJson(res, 502, { error: 'asr-failed', message: messageOf(error) });
  }
}

/** Locate the App's local device bridge (token + port) without guessing blindly. */
function bridgeConfig() {
  const homes = [];
  if (typeof process.env.DSH_HOME === 'string' && process.env.DSH_HOME !== '') homes.push(process.env.DSH_HOME);
  homes.push(join(homedir(), '.dsh'));
  homes.push(join(homedir(), '..', '..'));
  let token = '';
  let port = 0;
  for (const home of homes) {
    if (token === '') {
      try {
        const value = readFileSync(join(home, '.device-token'), 'utf8').trim();
        if (value !== '') token = value;
      } catch {
        /* try the next candidate */
      }
    }
    if (port === 0) {
      try {
        const value = Number.parseInt(readFileSync(join(home, 'device.port'), 'utf8').trim(), 10);
        if (Number.isInteger(value) && value > 0 && value < 65536) port = value;
      } catch {
        /* try the next candidate */
      }
    }
  }
  return { token, port };
}

/** Send one 16 kHz PCM16 WAV to the App and return its transcript. */
function bridgeTranscribe(audio, language) {
  const { token, port } = bridgeConfig();
  if (token === '' || port === 0) return Promise.reject(new Error('语音桥不可用'));
  if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF') {
    return Promise.reject(new Error('录音格式不支持'));
  }
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: `/device/asr?language=${encodeURIComponent(language)}`,
        headers: {
          'x-device-token': token,
          'content-type': 'application/octet-stream',
          'content-length': audio.length,
        },
        timeout: 120000,
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8').trim();
          if (response.statusCode === 200) {
            resolve({ text });
            return;
          }
          if (response.statusCode === 503) {
            reject(new Error(text === '' ? '语音识别引擎尚未准备好' : friendlyAsrError(text)));
            return;
          }
          reject(new Error(text === '' ? `语音识别失败（${response.statusCode}）` : friendlyAsrError(text)));
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('语音识别超时')));
    req.on('error', reject);
    req.end(audio);
  });
}

/* ---------------------------------------------------------------- helpers */

async function readBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, status, body) {
  if (res.writableEnded) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-transform',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Turn the bridge's machine codes into one sentence the page can show. */
function friendlyAsrError(text) {
  if (text.indexOf('ASR_MODEL_MISSING') >= 0 || text.indexOf('ASR_NOT_READY') >= 0) {
    return '语音识别模型未下载（约 163 MB），需要先在 App 内准备一次';
  }
  return text.replace(/^[A-Z_]+:\s*/, '');
}

/* ---------------------------------------------------------- model + search */

const reasoningCache = new Map();

/** Cached capability lookup: which reasoning efforts this exact route accepts. */
async function modelReasoning(llm, provider, model) {
  const key = `${provider}\u0000${model}`;
  if (reasoningCache.has(key)) return reasoningCache.get(key);
  let reasoning = null;
  try {
    const info = await llm.resolveModelInfo(provider, model);
    const declared = info?.reasoning;
    if (declared !== undefined && declared !== null && Array.isArray(declared.efforts)) {
      reasoning = { efforts: declared.efforts.map((effort) => effort.id), defaultEffort: declared.defaultEffort ?? null };
    }
  } catch {
    reasoning = null;
  }
  reasoningCache.set(key, reasoning);
  return reasoning;
}

/**
 * Map the page's 深度思考 switch onto the route's declared efforts.
 * Off picks a non-thinking effort when the model declares one; on prefers the
 * profile selection and falls back to the model default.
 */
function pickEffort(reasoning, selection, thinking) {
  if (reasoning === null || reasoning.efforts.length === 0) return undefined;
  if (!thinking) {
    const off = reasoning.efforts.find((id) => id === 'off' || id === 'none' || id === 'disabled');
    return off;
  }
  const selected = selection.reasoningEffort;
  if (typeof selected === 'string' && reasoning.efforts.includes(selected)) return selected;
  if (typeof reasoning.defaultEffort === 'string' && reasoning.efforts.includes(reasoning.defaultEffort)) {
    return reasoning.defaultEffort;
  }
  return reasoning.efforts[reasoning.efforts.length - 1];
}

/**
 * Run one web search for the current turn and stream its status.
 * @returns Markdown context for the system prompt, or '' when nothing was found.
 */
async function runSearch(ctx, payload, write, signal) {
  const web = ctx.get('web');
  if (web === undefined) {
    write({ type: 'search', phase: 'error', message: '联网搜索暂不可用' });
    return '';
  }
  const query = typeof payload.query === 'string' ? payload.query.trim().slice(0, 300) : '';
  if (query === '') {
    write({ type: 'search', phase: 'error', message: '缺少检索关键词' });
    return '';
  }
  try {
    const result = await web.search({ query, maxResults: 6 }, signal);
    const sources = (result?.sources ?? []).slice(0, 6).map((source) => ({
      title: source.title ?? source.url,
      url: source.url,
      snippet: source.snippet ?? '',
    }));
    write({ type: 'search', phase: 'done', sources, truncated: result?.truncated === true });

    const snippets =
      sources.length === 0
        ? ''
        : sources.map((source, index) => `${index + 1}. [${source.title}](${source.url})\n${source.snippet}`).join('\n\n');
    const pages = await readTopPages(web, sources, signal);
    const parts = [];
    if (typeof result?.content === 'string' && result.content.trim() !== '') parts.push(result.content.trim());
    if (snippets !== '') parts.push(snippets);
    if (pages !== '') parts.push(`【网页正文摘录】\n${pages}`);
    const digest = parts.join('\n\n').trim();
    if (digest === '') return '';
    return [
      '以下是从网页检索到的资料，可能不完整。回答时优先依据这些资料；引用具体信息后，用 Markdown 链接标注来源。',
      digest,
    ].join('\n\n');
  } catch (error) {
    const message = messageOf(error);
    write({
      type: 'search',
      phase: 'error',
      message: message.indexOf('WEB_PROVIDER') >= 0 ? '没有配置联网搜索服务' : message,
    });
    return '';
  }
}

/** Fetch the first two results so the model sees page text, not just links. */
async function readTopPages(web, sources, signal) {
  const picked = sources.slice(0, 2);
  const pages = await Promise.all(
    picked.map(async (source) => {
      try {
        const fetched = await web.fetch({ url: source.url }, signal);
        if (fetched === undefined || fetched === null) return null;
        if (typeof fetched.statusCode === 'number' && fetched.statusCode >= 400) return null;
        const body = fetched.body ?? {};
        const raw = typeof body.content === 'string' ? body.content : '';
        if (raw === '') return null;
        const text = (body.kind === 'html' ? htmlToText(raw) : raw).trim();
        if (text === '') return null;
        return `### ${source.title} — ${source.url}\n${text.slice(0, 1800)}`;
      } catch {
        return null;
      }
    }),
  );
  return pages.filter(Boolean).join('\n\n');
}

/** Small, dependency-free HTML-to-text pass for fetched pages. */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n');
}

/* ------------------------------------------------------------------ export */

/** Write the page's conversations next to the user's other downloads. */
async function exportConversations(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req, MAX_CHAT_BODY)).toString('utf8') || '{}');
  } catch (error) {
    return sendJson(res, 400, { error: 'bad-json', message: messageOf(error) });
  }
  const threads = Array.isArray(payload?.threads) ? payload.threads : null;
  if (threads === null) return sendJson(res, 400, { error: 'no-threads' });

  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  const stamp = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-');
  const name = `deepseek-chat-${stamp}.json`;
  const text = JSON.stringify(
    {
      version: 1,
      source: 'dsh-chat-replica',
      exportedAt: new Date().toISOString(),
      threads: threads.map(sanitizeThread),
    },
    null,
    2,
  );

  const requested = typeof payload.dir === 'string' ? payload.dir.trim() : '';
  const candidates = [];
  if (requested.startsWith('/')) candidates.push(join(requested, name));
  candidates.push(join('/sdcard/Download', name));
  candidates.push(join(homedir(), 'Download', name));

  const failures = [];
  for (const path of candidates) {
    try {
      await writeFile(path, text, 'utf8');
    } catch (error) {
      failures.push(`${dirname(path)}: ${messageOf(error)}`);
      continue;
    }
    const result = { path, name, dir: dirname(path), count: threads.length, bytes: Buffer.byteLength(text) };
    logExport({ ok: true, ...result, requested });
    return sendJson(res, 200, result);
  }
  const message = failures.join(' | ');
  logExport({ ok: false, requested, failures });
  sendJson(res, 500, { error: 'write-failed', message });
}

function sanitizeThread(thread) {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return {
    title: typeof thread?.title === 'string' ? thread.title : '',
    updatedAt: typeof thread?.updatedAt === 'number' ? thread.updatedAt : Date.now(),
    messages: messages
      .filter((message) => message !== null && typeof message === 'object')
      .map((message) => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        text: typeof message.text === 'string' ? message.text : '',
        ...(Array.isArray(message.files) && message.files.length > 0
          ? {
              files: message.files.map((file) => ({
                name: typeof file?.name === 'string' ? file.name : 'file',
                text: typeof file?.text === 'string' ? file.text : '',
              })),
            }
          : {}),
      })),
  };
}

/** Best-effort diagnostic trail for export outcomes (never throws). */
function logExport(entry) {
  const line = `${new Date().toISOString()} ${JSON.stringify(entry)}\n`;
  const homes = [
    typeof process.env.DSH_HOME === 'string' ? process.env.DSH_HOME : '',
    join(homedir(), '.dsh'),
    join(homedir(), '..', '..'),
  ];
  for (const home of homes) {
    if (home === '') continue;
    try {
      appendFileSync(join(home, 'chat-replica-export.log'), line);
      return;
    } catch {
      /* try the next candidate home */
    }
  }
}

/* ------------------------------------------------------------- system theme */

let schemeCache = { at: 0, value: 'unknown' };

/**
 * Read the phone's real night-mode switch.
 *
 * The WebView can report `prefers-color-scheme: dark` even when the system is
 * light (it follows the app's WebView theme, not the user's choice), so the
 * page asks the Host instead and the Host asks the device.
 * @returns 'light', 'dark', or 'unknown' when the bridge cannot answer.
 */
async function readSystemScheme() {
  const now = Date.now();
  if (now - schemeCache.at < 1500) return schemeCache.value;
  const answer = await bridgeGet(`/device/shell?cmd=${encodeURIComponent('cmd uimode night')}`);
  let value = 'unknown';
  if (typeof answer === 'string') {
    const text = answer.trim().toLowerCase();
    if (text.includes('night mode: yes')) value = 'dark';
    else if (text.includes('night mode: no')) value = 'light';
  }
  schemeCache = { at: now, value };
  return value;
}

/** One authenticated GET against the App's local device bridge. */
function bridgeGet(path) {
  const { token, port } = bridgeConfig();
  if (token === '' || port === 0) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = httpRequest(
      { host: '127.0.0.1', port, path, method: 'GET', headers: { 'x-device-token': token }, timeout: 4000 },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );
    request.on('timeout', () => request.destroy(new Error('bridge-timeout')));
    request.on('error', () => resolve(null));
    request.end();
  });
}

/* -------------------------------------------------------------------- tts */

const TTS_URL = 'https://api.deepseek.com/v1/tools/tts';
const TTS_VOICES = new Set(['stella', 'tide']);

/**
 * Proxy one read-aloud request to DeepSeek's streaming TTS endpoint.
 *
 * The page speaks the returned 24 kHz signed 16-bit PCM directly, mirroring the
 * chat demo (`POST /v1/tools/tts` with `format: 'pcm'`, `filter_markdown: true`).
 * The API key comes from the profile's credential store, so the page never needs
 * to hold one.
 */
async function speak(req, res, ctx) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req, MAX_CHAT_BODY)).toString('utf8') || '{}');
  } catch (error) {
    return sendJson(res, 400, { error: 'bad-json', message: messageOf(error) });
  }
  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 8000) : '';
  if (text === '') return sendJson(res, 400, { error: 'empty-text' });
  const voice = TTS_VOICES.has(payload.voice) ? payload.voice : 'stella';

  const key = await resolveApiKey(ctx);
  if (key === '') return sendJson(res, 503, { error: 'no-key', message: '没有可用的 DeepSeek API Key' });

  const abort = new AbortController();
  const onClose = () => abort.abort();
  res.on('close', onClose);
  try {
    const upstream = await fetch(TTS_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ text, voice_id: voice, format: 'pcm', filter_markdown: true }),
      signal: abort.signal,
    });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      return sendJson(res, 502, {
        error: 'tts-failed',
        status: upstream.status,
        message: detail.slice(0, 200) || `TTS ${upstream.status}`,
      });
    }
    if (upstream.body === null) return sendJson(res, 502, { error: 'tts-empty' });
    res.writeHead(200, {
      'content-type': upstream.headers.get('content-type') ?? 'audio/pcm; rate=24000',
      'cache-control': 'no-store, no-transform',
      'x-sample-rate': '24000',
    });
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (!res.headersSent) return sendJson(res, 502, { error: 'tts-failed', message: messageOf(error) });
    if (!res.writableEnded) res.end();
  } finally {
    res.off('close', onClose);
  }
}

/** Resolve the official DeepSeek API key from the profile's credential store. */
async function resolveApiKey(ctx) {
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return '';
  try {
    const resolved = await credentials.resolve('DEEPSEEK_API_KEY');
    if (resolved !== undefined && typeof resolved.value === 'string') return resolved.value.trim();
  } catch {
    /* fall through to unconfigured */
  }
  return '';
}
