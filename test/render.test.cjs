/**
 * Headless render test for the plugin's browser bundle (client.js).
 *
 * The bundle is a browser module that calls window.__ModuleLoader__.load and
 * uses a small React subset, so this script provides a minimal hook runtime,
 * a fake DOM, and a fake Cordis context, then drives real click handlers.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const FILE = process.env.PLUGIN_FILE || path.join(__dirname, '..', 'client.js');
const SOURCE = fs.readFileSync(FILE, 'utf8');

/* ------------------------------------------------------------- React subset */

let instances = new Map();
let domCache = new Map();
let classInstances = new Map();
let currentInst = null;
let renderRoot = null;
let dirty = false;
let rendering = false;

function sameDeps(a, b) {
  if (a === undefined || a === null || b === undefined || b === null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (!Object.is(a[i], b[i])) return false;
  return true;
}

/** Minimal class-component base, enough for an error boundary under test. */
class Component {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }
  setState(partial) {
    const next = typeof partial === 'function' ? partial(this.state, this.props) : partial;
    this.state = Object.assign({}, this.state, next || {});
    dirty = true;
    if (!rendering) rerender();
  }
}
Component.prototype.isReactComponent = {};

const React = {
  Component,
  createElement(type, props, ...children) {
    const flat = [];
    const push = (child) => {
      if (Array.isArray(child)) child.forEach(push);
      else if (child !== undefined) flat.push(child);
    };
    children.forEach(push);
    const next = props ? Object.assign({}, props) : {};
    if (flat.length === 1) next.children = flat[0];
    else if (flat.length > 1) next.children = flat;
    return { type, props: next };
  },
  useState(init) {
    const inst = currentInst;
    const index = inst.index++;
    if (!(index in inst.hooks)) inst.hooks[index] = typeof init === 'function' ? init() : init;
    const setter = (value) => {
      const next = typeof value === 'function' ? value(inst.hooks[index]) : value;
      if (Object.is(next, inst.hooks[index])) return;
      inst.hooks[index] = next;
      dirty = true;
      if (!rendering) rerender();
    };
    return [inst.hooks[index], setter];
  },
  useEffect(fn, deps) {
    const inst = currentInst;
    const index = inst.index++;
    const prev = inst.effects[index];
    if (!prev || !sameDeps(prev.deps, deps)) inst.pending.push({ index, fn, deps });
  },
  useMemo(fn, deps) {
    const inst = currentInst;
    const index = inst.index++;
    const prev = inst.memos[index];
    if (!prev || !sameDeps(prev.deps, deps)) inst.memos[index] = { value: fn(), deps };
    return inst.memos[index].value;
  },
  useCallback(fn, deps) {
    return React.useMemo(() => fn, deps);
  },
  useRef(init) {
    const inst = currentInst;
    const index = inst.index++;
    if (!(index in inst.hooks)) inst.hooks[index] = { current: init === undefined ? null : init };
    return inst.hooks[index];
  },
};

/* ------------------------------------------------------------------ fake DOM */

const pageDom = {
  style: {},
  className: 'cd-page',
  scrollHeight: 900,
  scrollTop: 0,
  focus() {},
  select() {},
  closest() {
    return pageDom;
  },
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 1280, bottom: 900, width: 1280, height: 900 };
  },
  contains() {
    return false;
  },
};

function makeDom(element) {
  const dom = {
    element,
    style: {},
    className: typeof element.props.className === 'string' ? element.props.className : '',
    scrollHeight: 120,
    scrollTop: 0,
    focused: false,
    selected: false,
    focus() {
      dom.focused = true;
    },
    select() {
      dom.selected = true;
    },
    closest(selector) {
      if (selector !== '.cd-page') return null;
      return pageDom;
    },
    getBoundingClientRect() {
      return { left: 12, top: 240, right: 249, bottom: 280, width: 237, height: 40 };
    },
    contains() {
      return false;
    },
  };
  return dom;
}

/* --------------------------------------------------------------- render core */

function renderTree(node, pathKey) {
  if (node === null || node === undefined || typeof node === 'boolean') return null;
  if (typeof node === 'string' || typeof node === 'number') return { kind: 'text', text: String(node) };
  if (Array.isArray(node)) {
    return node.map((child, index) => renderTree(child, pathKey + '/' + index)).filter(Boolean);
  }
  const type = node.type;
  if (typeof type === 'function') {
    if (type.prototype && type.prototype.isReactComponent) {
      const classKey = pathKey + ':' + (type.name || 'class');
      let instance = classInstances.get(classKey);
      if (!instance) {
        instance = new type(node.props);
        classInstances.set(classKey, instance);
      } else {
        instance.props = node.props;
      }
      const previousInst = currentInst;
      currentInst = null;
      let output;
      try {
        output = instance.render();
      } finally {
        currentInst = previousInst;
      }
      return renderTree(output, classKey);
    }
    const key = pathKey + ':' + (type.name || 'anon');
    let inst = instances.get(key);
    if (!inst) {
      inst = { hooks: [], effects: [], memos: [], index: 0, pending: [], key };
      instances.set(key, inst);
    }
    const previous = currentInst;
    currentInst = inst;
    inst.index = 0;
    let output;
    try {
      output = type(node.props);
    } finally {
      currentInst = previous;
    }
    return renderTree(output, key);
  }
  const children = node.props.children === undefined ? [] : renderTree(node.props.children, pathKey + '/c');
  const list = Array.isArray(children) ? children : children ? [children] : [];
  const element = { kind: 'host', type, props: node.props, children: list };
  // DOM nodes keep identity across renders, like the real reconciler.
  let dom = domCache.get(pathKey);
  if (!dom) {
    dom = makeDom(element);
    domCache.set(pathKey, dom);
  }
  dom.element = element;
  dom.className = typeof node.props.className === 'string' ? node.props.className : '';
  element.dom = dom;
  if (node.props.ref) node.props.ref.current = dom;
  return element;
}

function commitEffects() {
  for (const inst of instances.values()) {
    if (!inst.pending || inst.pending.length === 0) continue;
    const pending = inst.pending;
    inst.pending = [];
    for (const job of pending) {
      const prev = inst.effects[job.index];
      if (prev && typeof prev.cleanup === 'function') {
        try {
          prev.cleanup();
        } catch (error) {
          /* cleanup failures must not hide the render result */
        }
      }
      const cleanup = job.fn();
      inst.effects[job.index] = { deps: job.deps, cleanup };
    }
  }
}

function rerender() {
  if (!renderRoot) throw new Error('nothing mounted');
  rendering = true;
  try {
    let tree = null;
    let guard = 0;
    do {
      dirty = false;
      for (const inst of instances.values()) inst.pending = [];
      tree = renderTree(renderRoot.element, 'root');
      commitEffects();
      guard += 1;
    } while (dirty && guard < 60);
    if (dirty) throw new Error('render did not settle (possible state loop)');
    return tree;
  } finally {
    rendering = false;
  }
}

/* ------------------------------------------------------------- tree utilities */

function walk(node, visit) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  visit(node);
  if (node.children) node.children.forEach((child) => walk(child, visit));
}

function collect(tree, predicate) {
  const out = [];
  walk(tree, (node) => {
    if (predicate(node)) out.push(node);
  });
  return out;
}

function hasClass(node, name) {
  return (
    node.kind === 'host' &&
    typeof node.props.className === 'string' &&
    node.props.className.split(/\s+/).indexOf(name) >= 0
  );
}

const byClass = (tree, name) => collect(tree, (node) => hasClass(node, name));

function textOf(node) {
  let text = '';
  walk(node, (child) => {
    if (child.kind === 'text') text += child.text;
  });
  return text;
}

function findByText(tree, text) {
  return collect(tree, (node) => node.kind === 'host' && textOf(node).trim() === text);
}

function click(node, extra) {
  if (!node.props.onClick) throw new Error('no onClick on <' + node.type + '>');
  node.props.onClick(
    Object.assign(
      {
        preventDefault() {},
        stopPropagation() {},
        currentTarget: node.dom,
        target: node.dom,
      },
      extra || {},
    ),
  );
}

/* ------------------------------------------------------------------- mounting */

let documentListeners = new Map();

function makeDocument() {
  documentListeners = new Map();
  return {
    visibilityState: 'visible',
    addEventListener(name, handler) {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push(handler);
    },
    removeEventListener(name, handler) {
      const list = documentListeners.get(name) || [];
      const index = list.indexOf(handler);
      if (index >= 0) list.splice(index, 1);
    },
  };
}

function emitDocument(name, event) {
  (documentListeners.get(name) || []).slice().forEach((handler) => handler(event));
}

function mount(storageSeed, options) {
  instances = new Map();
  domCache = new Map();
  classInstances = new Map();
  currentInst = null;
  renderRoot = null;
  dirty = false;
  rendering = false;

  const failWrites = Boolean(options && options.failWrites);
  const timerDelays = [];
  const storage = new Map(Object.entries(storageSeed || {}));
  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      if (failWrites) throw new Error('QuotaExceededError');
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  let captured = null;
  const windowListeners = new Map();
  const window = {
    __ModuleLoader__: {
      load(definition) {
        captured = definition;
      },
    },
    localStorage,
    innerWidth: 1280,
    innerHeight: 900,
    matchMedia() {
      return { matches: true, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };
    },
    addEventListener(name, handler) {
      windowListeners.set(name, (windowListeners.get(name) || []).concat([handler]));
    },
    removeEventListener() {},
  };
  const sandbox = {
    window,
    document: makeDocument(),
    console,
    setTimeout: (fn, ms) => {
      timerDelays.push(ms);
      return setTimeout(fn, ms);
    },
    clearTimeout,
    fetch: options && typeof options.fetch === 'function'
      ? (...args) => options.fetch(...args)
      : async () => ({ ok: true, json: async () => ({}), text: async () => '{}' }),
    Blob,
    AbortController,
    URL,
    navigator: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: FILE });
  if (!captured) throw new Error('module loader was never called');

  const plugin = captured.factory((id) => {
    if (id === 'react') return React;
    throw new Error('unexpected module request: ' + id);
  });
  if (typeof plugin.apply !== 'function') throw new Error('plugin has no apply()');

  const registered = new Map();
  const ctx = {
    locale: {
      register: () => () => {},
      bind: () => (key) => key,
    },
    slots: {
      inject: (name, factory) => factory(),
      register: (meta, component) => {
        registered.set((meta.name || '') + '|' + (meta.key || meta.id || ''), component);
        return () => {};
      },
    },
    get: () => null,
    effect: (fn) => {
      const result = fn();
      return typeof result === 'function' ? result : () => {};
    },
  };
  plugin.apply(ctx);

  return {
    registered,
    storage,
    timerDelays,
    /** Dispatch a window-level event, e.g. the Ctrl+F / Escape listeners. */
    emitWindow(name, event) {
      (windowListeners.get(name) || []).slice().forEach((handler) => handler(event));
    },
  };
}

function renderPanel(session) {
  const ChatReplica = session.registered.get('main|deepseek-chat-ui');
  if (!ChatReplica) throw new Error('main panel was not registered');
  renderRoot = {
    element: React.createElement(ChatReplica, {
      getTheme: () => null,
      getLocale: () => null,
      getWorkspace: () => null,
    }),
  };
  return rerender();
}

/** Run every mounted effect cleanup, like switching away from the panel. */
function unmount() {
  for (const inst of instances.values()) {
    for (const effect of inst.effects) {
      if (effect && typeof effect.cleanup === 'function') {
        try {
          effect.cleanup();
        } catch (error) {
          /* an unmount cleanup failure must not mask the assertion */
        }
      }
    }
  }
  renderRoot = null;
}

function snapshot(session) {
  const storage = {};
  session.storage.forEach((value, key) => {
    storage[key] = value;
  });
  return storage;
}

/* --------------------------------------------------------------------- tests */

let checks = 0;
function assert(condition, message) {
  checks += 1;
  if (!condition) throw new Error('ASSERT FAILED: ' + message);
}

function itemTitles(tree) {
  return byClass(tree, 'cd-item').map((item) => textOf(byClass(item, 'cd-item-title')[0]).trim());
}

function groupHeaders(tree) {
  return byClass(tree, 'cd-section-header').map((node) => textOf(node).trim());
}

function menuItems(tree) {
  return byClass(tree, 'cd-session-menu-item');
}

function storedThreads(storage) {
  const raw = storage.get('deepseek-chat-ui.threads.v1');
  return raw ? JSON.parse(raw) : null;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  /* --- 1. every row carries a three-dot menu ------------------------------ */
  {
    const session = mount();
    const tree = renderPanel(session);
    const items = byClass(tree, 'cd-item');
    assert(items.length === 5, 'five seed conversations render, got ' + items.length);
    items.forEach((item, index) => {
      const trigger = byClass(item, 'cd-item-menu');
      assert(trigger.length === 1, 'row ' + index + ' has exactly one menu button');
    });
    assert(byClass(tree, 'cd-session-menu').length === 0, 'menu starts closed');
    console.log('PASS 1: every conversation row has a ... menu');
  }

  /* --- 2. the menu lists rename / pin / multi-select / delete -------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-session-menu').length === 1, 'menu opens');
    const labels = menuItems(tree).map((node) => textOf(node).trim());
    assert(
      JSON.stringify(labels) === JSON.stringify(['重命名', '置顶', '多选', '导出 JSON', '导出 Markdown', '删除']),
      'menu labels are 重命名/置顶/多选/导出 JSON/导出 Markdown/删除, got ' + JSON.stringify(labels),
    );
    assert(byClass(tree, 'cd-session-menu-danger').length === 1, 'delete row is the danger row');
    assert(byClass(tree, 'cd-session-menu-sep').length === 1, 'delete sits after a separator');

    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-session-menu').length === 0, 'pressing the same trigger again closes the menu');

    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    emitDocument('keydown', { key: 'Escape' });
    tree = rerender();
    assert(byClass(tree, 'cd-session-menu').length === 0, 'Escape closes the menu');
    console.log('PASS 2: menu items and dismissal');
  }

  /* --- 3. rename writes the title back ------------------------------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    const before = itemTitles(tree)[0];
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-dialog').length === 1, 'rename dialog opens');
    assert(findByText(tree, '重命名对话').length > 0, 'rename dialog title');
    let input = byClass(tree, 'cd-dialog-input')[0];
    assert(input, 'rename dialog has an input');
    assert(input.props.value === before, 'input seeded with the current title');
    input.props.onChange({ target: { value: '新的对话标题' } });
    tree = rerender();
    input = byClass(tree, 'cd-dialog-input')[0];
    assert(input.props.value === '新的对话标题', 'input keeps the draft');
    click(byClass(tree, 'cd-btn-primary')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-dialog').length === 0, 'dialog closes after saving');
    assert(itemTitles(tree)[0] === '新的对话标题', 'row title updates: ' + itemTitles(tree)[0]);
    await wait(520);
    const saved = storedThreads(session.storage);
    assert(saved && saved.some((thread) => thread.title === '新的对话标题'), 'renamed title persisted');
    console.log('PASS 3: rename updates and persists the title');
  }

  /* --- 4. pin moves the conversation into a top group --------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    const titles = itemTitles(tree);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[1]);
    tree = rerender();
    assert(byClass(tree, 'cd-session-menu').length === 0, 'menu closes after pinning');
    assert(groupHeaders(tree)[0] === '置顶', 'pinned group leads the list');
    const pinnedSection = byClass(tree, 'cd-section')[0];
    assert(
      textOf(byClass(pinnedSection, 'cd-item-title')[0]).trim() === titles[0],
      'pinned conversation moved into the top group',
    );
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    const labels = menuItems(tree).map((node) => textOf(node).trim());
    assert(labels[1] === '取消置顶', 'menu offers unpin for a pinned row, got ' + labels[1]);
    click(menuItems(tree)[1]);
    tree = rerender();
    assert(groupHeaders(tree)[0] !== '置顶', 'unpin drops the pinned group');
    await wait(520);
    const saved = storedThreads(session.storage);
    assert(saved && saved.every((thread) => thread.pinnedAt === undefined), 'unpin persisted');
    console.log('PASS 4: pin / unpin reorders into a top group');
  }

  /* --- 5. multi-select pin and delete ------------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[2]);
    tree = rerender();
    assert(byClass(tree, 'cd-multibar').length === 1, 'multi-select toolbar opens');
    assert(
      textOf(byClass(tree, 'cd-multibar-count')[0]).trim() === '已选 1 个',
      'opening multi-select preselects the row: ' + textOf(byClass(tree, 'cd-multibar-count')[0]),
    );
    assert(byClass(tree, 'cd-item-menu').length === 0, 'row menus hide while selecting');
    assert(byClass(tree, 'cd-check').length === 5, 'every row shows a checkbox');

    click(byClass(tree, 'cd-item')[1]);
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-multibar-count')[0]).trim() === '已选 2 个',
      'second row toggles into the selection',
    );
    assert(byClass(tree, 'cd-check-on').length === 2, 'two checkboxes are checked');

    click(byClass(tree, 'cd-multibar-btn')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-multibar').length === 0, 'bulk pin leaves multi-select');
    assert(groupHeaders(tree)[0] === '置顶', 'bulk pin creates the pinned group');
    assert(byClass(byClass(tree, 'cd-section')[0], 'cd-item').length === 2, 'two rows pinned');

    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[2]);
    tree = rerender();
    click(byClass(tree, 'cd-item')[1]);
    tree = rerender();
    click(byClass(tree, 'cd-multibar-btn')[2]);
    tree = rerender();
    assert(byClass(tree, 'cd-delete-confirm').length === 1, 'bulk delete asks for confirmation');
    assert(
      textOf(byClass(tree, 'cd-delete-title')[0]).trim() === '删除后，选中的 2 个对话将不可恢复',
      'bulk delete title: ' + textOf(byClass(tree, 'cd-delete-title')[0]),
    );
    assert(
      textOf(byClass(tree, 'cd-confirm-pill-danger')[0]).trim() === '删除选中的 2 个对话',
      'bulk delete action text',
    );
    click(byClass(tree, 'cd-confirm-pill-cancel')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-delete-confirm').length === 0, 'cancel dismisses the confirmation');
    assert(byClass(tree, 'cd-item').length === 5, 'nothing deleted after cancel');

    click(byClass(tree, 'cd-multibar-btn')[2]);
    tree = rerender();
    click(byClass(tree, 'cd-confirm-pill-danger')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 3, 'bulk delete removed both conversations');
    assert(byClass(tree, 'cd-multibar').length === 0, 'multi-select ends after deleting');
    await wait(520);
    const saved = storedThreads(session.storage);
    assert(saved && saved.length === 3, 'bulk delete persisted');
    console.log('PASS 5: multi-select pin and delete');
  }

  /* --- 6. single delete confirmation copy and focus ----------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[5]);
    tree = rerender();
    assert(byClass(tree, 'cd-delete-confirm').length === 1, 'delete confirmation opens');
    assert(
      textOf(byClass(tree, 'cd-delete-title')[0]).trim() === '删除后，该对话将不可恢复',
      'exact confirmation title, got ' + textOf(byClass(tree, 'cd-delete-title')[0]),
    );
    assert(
      textOf(byClass(tree, 'cd-delete-note')[0]).trim() === '8 秒内可在提示条点「撤销」；超过 8 秒就会永久删除。',
      'the confirmation explains the undo window: ' + textOf(byClass(tree, 'cd-delete-note')[0]),
    );
    const danger = byClass(tree, 'cd-confirm-pill-danger')[0];
    const cancel = byClass(tree, 'cd-confirm-pill-cancel')[0];
    assert(textOf(danger).trim() === '删除该对话', 'danger pill label');
    assert(textOf(cancel).trim() === '取消', 'cancel pill label');
    assert(cancel.dom.focused === true, 'cancel holds the initial focus');
    click(danger);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 4, 'confirmed delete removes the conversation');
    assert(byClass(tree, 'cd-delete-confirm').length === 0, 'confirmation closes');
    console.log('PASS 6: delete confirmation copy, focus and removal');
  }

  /* --- 7. pinned state survives a reload ---------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[1]);
    tree = rerender();
    click(menuItems(tree)[1]);
    tree = rerender();
    await wait(520);
    const storage = {};
    session.storage.forEach((value, key) => {
      storage[key] = value;
    });
    const reloaded = mount(storage);
    const tree2 = renderPanel(reloaded);
    assert(groupHeaders(tree2)[0] === '置顶', 'pinned group restored after reload');
    console.log('PASS 7: pinned state persists across reload');
  }

  /* --- 8. delete survives leaving the panel immediately -------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    await wait(520); // let the first render persist, so the seed is the baseline
    const victim = itemTitles(tree)[0];
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[5]);
    tree = rerender();
    click(byClass(tree, 'cd-confirm-pill-danger')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 4, 'conversation deleted in the open panel');
    unmount(); // switch away before the 400ms debounce could fire
    const reopened = mount(snapshot(session));
    const tree2 = renderPanel(reopened);
    assert(byClass(tree2, 'cd-item').length === 4, 'deleted conversation stays gone after re-entering');
    assert(itemTitles(tree2).indexOf(victim) < 0, 'deleted title no longer listed: ' + victim);
    console.log('PASS 8: delete survives leaving and re-entering the panel');
  }

  /* --- 9. an emptied list must not resurrect the demo seeds ---------------- */
  {
    const session = mount({ 'deepseek-chat-ui.threads.v1': '[]' });
    const tree = renderPanel(session);
    assert(byClass(tree, 'cd-item').length === 0, 'saved empty list stays empty');
    assert(byClass(tree, 'cd-list-empty').length === 1, 'empty state is rendered');
    console.log('PASS 9: empty list does not fall back to demo conversations');
  }

  /* --- 10. rename survives leaving the panel immediately ------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    await wait(520);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[0]);
    tree = rerender();
    byClass(tree, 'cd-dialog-input')[0].props.onChange({ target: { value: '离开前改的名字' } });
    tree = rerender();
    click(byClass(tree, 'cd-btn-primary')[0]);
    tree = rerender();
    unmount();
    const reopened = mount(snapshot(session));
    const tree2 = renderPanel(reopened);
    assert(itemTitles(tree2)[0] === '离开前改的名字', 'renamed title survives a panel switch');
    console.log('PASS 10: rename survives leaving and re-entering the panel');
  }

  /* --- 11. drafts are per conversation and survive leaving ----------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-ta').length === 1, 'composer textarea is rendered');
    byClass(tree, 'cd-ta')[0].props.onChange({ target: { value: '草稿 A' } });
    tree = rerender();
    assert(byClass(tree, 'cd-ta')[0].props.value === '草稿 A', 'draft typed in the first conversation');

    click(byClass(tree, 'cd-item')[1]);
    tree = rerender();
    assert(byClass(tree, 'cd-ta')[0].props.value === '', 'switching conversation does not carry the draft');
    byClass(tree, 'cd-ta')[0].props.onChange({ target: { value: '草稿 B' } });
    tree = rerender();

    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-ta')[0].props.value === '草稿 A', 'the first draft comes back on return');

    await wait(420);
    unmount();
    const reopened = mount(snapshot(session));
    const tree2 = renderPanel(reopened);
    click(byClass(tree2, 'cd-item')[0]);
    const tree3 = rerender();
    assert(byClass(tree3, 'cd-ta')[0].props.value === '草稿 A', 'draft survives leaving and re-entering');
    console.log('PASS 11: drafts are stored per conversation');
  }

  /* --- 12. search filters by title and message body ------------------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    assert(byClass(tree, 'cd-filter-input').length === 1, 'search input is rendered');
    byClass(tree, 'cd-filter-input')[0].props.onChange({ target: { value: '灵隐寺' } });
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 1, 'a body-only hit filters to one row');
    assert(itemTitles(tree)[0] === '杭州两天一夜怎么安排', 'the matching conversation is listed');

    byClass(tree, 'cd-filter-input')[0].props.onChange({ target: { value: '没有这个关键词' } });
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 0, 'no rows for a miss');
    assert(byClass(tree, 'cd-list-empty').length === 1, 'the empty state is shown');
    assert(
      textOf(byClass(tree, 'cd-list-empty')[0]).trim() === '没有匹配的对话',
      'the empty state uses the search copy',
    );

    click(byClass(tree, 'cd-filter-clear')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 5, 'clearing the query restores every conversation');
    console.log('PASS 12: conversation search filters the list');
  }

  /* --- 13. the row menu is keyboard navigable ------------------------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    let items = byClass(tree, 'cd-session-menu-item');
    assert(items.length === 6, 'the menu has six items');
    assert(items[0].dom.focused === true, 'the first item takes focus when the menu opens');
    const menu = byClass(tree, 'cd-session-menu')[0];
    const key = (name) => menu.props.onKeyDown({ key: name, preventDefault() {}, stopPropagation() {} });
    key('ArrowDown');
    items = byClass(tree, 'cd-session-menu-item');
    assert(items[1].dom.focused === true, 'ArrowDown moves to the next item');
    key('ArrowUp');
    items = byClass(tree, 'cd-session-menu-item');
    assert(items[0].dom.focused === true, 'ArrowUp moves back');
    key('End');
    items = byClass(tree, 'cd-session-menu-item');
    assert(items[5].dom.focused === true, 'End jumps to the last item');
    key('Home');
    items = byClass(tree, 'cd-session-menu-item');
    assert(items[0].dom.focused === true, 'Home jumps to the first item');
    console.log('PASS 13: the conversation menu navigates with the keyboard');
  }

  /* --- 14. Escape leaves multi-select -------------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[2]);
    tree = rerender();
    assert(byClass(tree, 'cd-multibar').length === 1, 'multi-select is active');
    emitDocument('keydown', { key: 'Escape' });
    tree = rerender();
    assert(byClass(tree, 'cd-multibar').length === 0, 'Escape leaves multi-select');
    console.log('PASS 14: Escape leaves multi-select');
  }

  /* --- 15. select all / clear all ------------------------------------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[2]);
    tree = rerender();
    const selectAll = findByText(tree, '全选')[0];
    assert(selectAll, 'the select-all control is rendered');
    click(selectAll);
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-multibar-count')[0]).trim() === '已选 5 个',
      'select all selects every conversation: ' + textOf(byClass(tree, 'cd-multibar-count')[0]),
    );
    const clearAll = findByText(tree, '取消全选')[0];
    assert(clearAll, 'the control flips to clear-all when everything is selected');
    click(clearAll);
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-multibar-count')[0]).trim() === '已选 0 个',
      'clear-all deselects everything',
    );
    console.log('PASS 15: select all and clear all');
  }

  /* --- 16. rows support F2 and Delete -------------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    const key = (name) => byClass(tree, 'cd-item')[0].props.onKeyDown({
      key: name,
      preventDefault() {},
      stopPropagation() {},
    });
    key('F2');
    tree = rerender();
    assert(byClass(tree, 'cd-dialog').length === 1, 'F2 opens the rename dialog');
    click(byClass(tree, 'cd-btn')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-dialog').length === 0, 'the rename dialog closes again');
    key('Delete');
    tree = rerender();
    assert(byClass(tree, 'cd-delete-confirm').length === 1, 'Delete opens the delete confirmation');
    console.log('PASS 16: F2 renames and Delete asks to delete');
  }

  /* --- 17. bulk export reports through the toast --------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[2]);
    tree = rerender();
    const exportAll = findByText(tree, '导出')[0];
    assert(exportAll, 'the bulk export control is rendered');
    click(exportAll);
    await wait(60);
    tree = rerender();
    assert(byClass(tree, 'cd-toast').length === 1, 'the export result is announced in the toast');
    console.log('PASS 17: bulk export reports its result');
  }

  /* --- 18. a failed localStorage write is announced ------------------------ */
  {
    const session = mount(undefined, { failWrites: true });
    renderPanel(session);
    await wait(520);
    const tree = rerender();
    assert(byClass(tree, 'cd-toast').length === 1, 'a failed localStorage write surfaces as a toast');
    assert(
      textOf(byClass(tree, 'cd-toast')[0]).indexOf('本地存储已满') >= 0,
      'the toast explains that storage is full',
    );
    console.log('PASS 18: storage failures are reported');
  }

  /* --- 19. import skips duplicates ----------------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-settings')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-modal').length === 1, 'the settings dialog opens');
    const modal = byClass(tree, 'cd-modal')[0];
    const input = byClass(modal, 'cd-file-input')[0];
    assert(input, 'the import file input is rendered');
    const entry = {
      title: '重复导入测试',
      updatedAt: 1700000000000,
      messages: [
        { role: 'user', text: '你好' },
        { role: 'assistant', text: '你好呀' },
      ],
    };
    const payload = JSON.stringify({ threads: [entry, entry] });
    const file = {
      text: async function () {
        return payload;
      },
    };
    input.props.onChange({ target: { files: [file], value: '' } });
    await wait(40);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 6, 'only one copy of a duplicated import is added');
    const status = byClass(tree, 'cd-status')[0];
    assert(
      status && textOf(status).indexOf('跳过 1 个重复') >= 0,
      'the status reports the skipped duplicate: ' + (status ? textOf(status) : 'none'),
    );
    console.log('PASS 19: importing skips duplicates');
  }

  /* --- 20. messages show their local time ---------------------------------- */
  {
    const at = 1700000000000;
    const session = mount({
      'deepseek-chat-ui.threads.v1': JSON.stringify([
        {
          id: 't-clock',
          title: '带时间戳的会话',
          updatedAt: at,
          messages: [
            { id: 'm1', role: 'user', text: '你好', at: at },
            { id: 'm2', role: 'assistant', text: '你好呀', at: at + 60000 },
          ],
        },
      ]),
    });
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    const clock = byClass(tree, 'cd-time');
    assert(clock.length === 2, 'both messages render a time label');
    const date = new Date(at);
    const expected = String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    assert(textOf(clock[0]).trim() === expected, 'the label is the local HH:MM of the message: ' + textOf(clock[0]));
    console.log('PASS 20: messages show their local time');
  }

  /* --- 21. one conversation can be exported from its menu ------------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[3]);
    await wait(60);
    tree = rerender();
    assert(byClass(tree, 'cd-toast').length === 1, 'single export reports through the toast');
    console.log('PASS 21: a single conversation exports from its menu');
  }

  /* --- 22. deletion can be undone within 8 seconds ------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[5]);
    tree = rerender();
    click(byClass(tree, 'cd-confirm-pill-danger')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 4, 'the conversation is deleted');
    assert(byClass(tree, 'cd-undo-toast').length === 1, 'an undo toast appears after deleting');
    const undoButton = byClass(tree, 'cd-undo-btn')[0];
    assert(undoButton, 'the toast offers an undo action');
    assert(textOf(undoButton).trim() === '撤销', 'the undo action is labelled 撤销');
    assert(session.timerDelays.indexOf(8000) >= 0, 'the undo window is 8 seconds');
    click(undoButton);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 5, 'undo restores the conversation');
    assert(byClass(tree, 'cd-undo-toast').length === 0, 'the undo toast goes away');
    console.log('PASS 22: deleting can be undone within 8 seconds');
  }

  /* --- 23. Enter in the search opens the first match ----------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    byClass(tree, 'cd-filter-input')[0].props.onChange({ target: { value: '灵隐寺' } });
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 1, 'the search narrowed the list');
    const input = byClass(tree, 'cd-filter-input')[0];
    input.props.onKeyDown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-header-title')[0]).trim() === '杭州两天一夜怎么安排',
      'Enter opens the first matching conversation: ' + textOf(byClass(tree, 'cd-header-title')[0]),
    );
    console.log('PASS 23: Enter opens the first search result');
  }

  /* --- 24. an answer can be forked into a new conversation ----------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    const forkButton = collect(
      tree,
      (node) => node.kind === 'host' && node.props['aria-label'] === '分叉',
    )[0];
    assert(forkButton, 'the assistant answer offers a fork action');
    click(forkButton);
    tree = rerender();
    assert(byClass(tree, 'cd-item').length === 6, 'forking adds a conversation');
    const title = textOf(byClass(tree, 'cd-header-title')[0]).trim();
    assert(title.indexOf('分叉') >= 0, 'the forked conversation has a distinct title: ' + title);
    assert(byClass(tree, 'cd-md').length >= 1, 'the forked conversation keeps the copied answer');
    console.log('PASS 24: an answer can be forked into a new conversation');
  }

  /* --- 25. a user message can be edited and re-answered -------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    const editButton = collect(
      tree,
      (node) => node.kind === 'host' && node.props['aria-label'] === '编辑',
    )[0];
    assert(editButton, 'the user message offers an edit action');
    click(editButton);
    tree = rerender();
    const area = byClass(tree, 'cd-dialog-textarea')[0];
    assert(area, 'the edit dialog opens with a textarea');
    assert(area.props.value.length > 0, 'the textarea starts from the current message');
    area.props.onChange({ target: { value: '改过的问题' } });
    tree = rerender();
    click(findByText(tree, '保存并重新生成')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-dialog').length === 0, 'the edit dialog closes');
    assert(
      textOf(byClass(tree, 'cd-bubble')[0]).trim() === '改过的问题',
      'the edited message replaces the old one: ' + textOf(byClass(tree, 'cd-bubble')[0]),
    );
    assert(byClass(tree, 'cd-item').length === 5, 'editing does not add conversations');
    console.log('PASS 25: a user message can be edited and re-answered');
  }

  /* --- 26. text size setting drives the --cd-text-size variable ------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    const pageStyle = () => byClass(tree, 'cd-page')[0].props.style || {};
    assert(pageStyle()['--cd-text-size'] === '16px', 'standard is the default text size');
    click(byClass(tree, 'cd-settings')[0]);
    tree = rerender();
    const choices = byClass(tree, 'cd-choice');
    assert(choices.length === 3, 'three text sizes are offered, got ' + choices.length);
    const labels = choices.map((node) => textOf(node).trim());
    assert(
      JSON.stringify(labels) === JSON.stringify(['小', '标准', '大']),
      'the text size labels are 小/标准/大, got ' + JSON.stringify(labels),
    );
    click(choices[0]);
    tree = rerender();
    assert(pageStyle()['--cd-text-size'] === '14px', 'small sets the variable to 14px');
    click(byClass(tree, 'cd-choice')[2]);
    tree = rerender();
    assert(pageStyle()['--cd-text-size'] === '18px', 'large sets the variable to 18px');
    assert(session.storage.get('deepseek-chat-ui.font.v1') === 'large', 'the choice is persisted');
    unmount();
    const reopened = mount(snapshot(session));
    const tree2 = renderPanel(reopened);
    assert(
      byClass(tree2, 'cd-page')[0].props.style['--cd-text-size'] === '18px',
      'the saved text size is restored on reload',
    );
    console.log('PASS 26: text size setting drives --cd-text-size');
  }

  /* --- 27. the settings footer shows the version and the repo link --------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-settings')[0]);
    tree = rerender();
    const foot = byClass(tree, 'cd-settings-foot')[0];
    assert(foot, 'the settings footer is rendered');
    const footText = textOf(foot).replace(/\s+/g, '');
    assert(
      /^v\d+\.\d+\.\d+·GitHub·检查更新$/.test(footText),
      'the footer reads vX.Y.Z · GitHub · 检查更新: ' + footText,
    );
    const link = byClass(foot, 'cd-settings-repo')[0];
    assert(link && link.type === 'a', 'the GitHub label is a link');
    assert(link.props.href === 'https://github.com/AlphaAntivoid/dsh-chat-replica', 'the link targets the repository');
    assert(link.props.target === '_blank', 'the link opens in a new tab');
    assert(link.props.rel === 'noreferrer', 'the link sets rel=noreferrer');
    console.log('PASS 27: settings footer shows the version and repository link');
  }

  /* --- 28. one conversation exports as Markdown ---------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item-menu')[0]);
    tree = rerender();
    click(menuItems(tree)[4]);
    await wait(60);
    tree = rerender();
    assert(byClass(tree, 'cd-toast').length === 1, 'markdown export reports through the toast');
    console.log('PASS 28: a conversation exports as Markdown');
  }

  /* --- 29. find inside the open conversation ------------------------------- */
  {
    const session = mount();
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    const openFind = collect(tree, (node) => node.kind === 'host' && node.props['aria-label'] === '查找')[0];
    assert(openFind, 'the header offers a find action');
    click(openFind);
    tree = rerender();
    let input = byClass(tree, 'cd-find-input')[0];
    assert(input, 'the find bar opens');
    input.props.onChange({ target: { value: '防抖' } });
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-find-count')[0]).trim() === '1/2',
      'the counter counts matching messages: ' + textOf(byClass(tree, 'cd-find-count')[0]),
    );
    assert(byClass(tree, 'cd-mark').length > 0, 'the matching text is highlighted');
    input = byClass(tree, 'cd-find-input')[0];
    input.props.onKeyDown({ key: 'Enter', preventDefault() {}, stopPropagation() {} });
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-find-count')[0]).trim() === '2/2',
      'Enter moves to the next match: ' + textOf(byClass(tree, 'cd-find-count')[0]),
    );
    input = byClass(tree, 'cd-find-input')[0];
    input.props.onKeyDown({ key: 'Escape', stopPropagation() {} });
    tree = rerender();
    assert(byClass(tree, 'cd-find').length === 0, 'Escape closes the find bar');
    console.log('PASS 29: a conversation can be searched in place');
  }

  /* --- 30. the model picker opens, lists the default and closes ------------ */
  {
    const session = mount();
    let tree = renderPanel(session);
    const chip = byClass(tree, 'cd-model-chip')[0];
    assert(chip, 'the composer offers a model chip');
    assert(textOf(chip).trim() === '默认模型', 'the chip names the fallback: ' + textOf(chip));
    click(chip);
    tree = rerender();
    assert(byClass(tree, 'cd-model-menu').length === 1, 'the model menu opens');
    assert(
      findByText(tree, '跟随默认').length >= 1,
      'the menu offers following the default, menu=' + JSON.stringify(textOf(byClass(tree, 'cd-model-menu')[0])),
    );
    const mask = byClass(tree, 'cd-model-mask')[0];
    click(mask);
    tree = rerender();
    assert(byClass(tree, 'cd-model-menu').length === 0, 'clicking the mask closes the menu');
    console.log('PASS 30: the model picker opens and closes');
  }

  /* --- 31. the model picker lists providers and persists a choice ---------- */
  {
    const catalog = {
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          models: [
            { id: 'deepseek-chat', name: 'DeepSeek Chat' },
            { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
          ],
        },
        { id: 'local', name: 'Local', models: [{ id: 'qwen3', name: 'Qwen3 32B' }] },
      ],
      current: { provider: 'deepseek', model: 'deepseek-chat' },
    };
    const session = mount(undefined, {
      fetch: async (url) => {
        if (String(url).indexOf('/models') >= 0) {
          return { ok: true, json: async () => catalog, text: async () => '{}' };
        }
        return { ok: true, json: async () => ({}), text: async () => '{}' };
      },
    });
    let tree = renderPanel(session);
    await wait(10);
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-model-chip')[0]).trim() === 'DeepSeek Chat',
      'the chip shows the default model name: ' + textOf(byClass(tree, 'cd-model-chip')[0]),
    );
    click(byClass(tree, 'cd-model-chip')[0]);
    tree = rerender();
    assert(byClass(tree, 'cd-model-group').length === 2, 'providers are grouped in the menu');
    assert(findByText(tree, 'Qwen3 32B').length >= 1, 'provider models are listed');
    const localItem = byClass(tree, 'cd-session-menu-item').find((node) => textOf(node).trim() === 'Qwen3 32B');
    click(localItem);
    tree = rerender();
    assert(
      textOf(byClass(tree, 'cd-model-chip')[0]).trim() === 'Qwen3 32B',
      'the chip follows the picked model: ' + textOf(byClass(tree, 'cd-model-chip')[0]),
    );
    const stored = session.storage.get('deepseek-chat-ui.model.v1');
    assert(stored !== undefined && JSON.parse(stored).model === 'qwen3', 'the choice is persisted');
    console.log('PASS 31: the model picker lists providers and persists a choice');
  }

  /* --- 32. the settings page checks for updates ---------------------------- */
  {
    const session = mount(undefined, {
      fetch: async (url) => {
        if (String(url).indexOf('/update') >= 0) {
          return {
            ok: true,
            json: async () => ({ ok: true, version: '9.9.9', url: 'https://example.test/release' }),
            text: async () => '{}',
          };
        }
        return { ok: true, json: async () => ({}), text: async () => '{}' };
      },
    });
    let tree = renderPanel(session);
    click(byClass(tree, 'cd-settings')[0]);
    tree = rerender();
    const check = byClass(tree, 'cd-settings-update')[0];
    assert(check, 'the settings footer offers a check for updates action');
    click(check);
    await wait(10);
    tree = rerender();
    assert(
      findByText(tree, '新版本 v9.9.9').length >= 1,
      'a newer release is reported: ' + textOf(byClass(tree, 'cd-settings-update')[0]),
    );
    console.log('PASS 32: the settings page checks for updates');
  }

  /* --- 33. accessibility audit across the main surfaces -------------------- */
  {
    const nameOf = (node) => {
      const props = node.props || {};
      const aria = typeof props['aria-label'] === 'string' ? props['aria-label'].trim() : '';
      if (aria !== '') return aria;
      const title = typeof props.title === 'string' ? props.title.trim() : '';
      if (title !== '') return title;
      return textOf(node).trim();
    };
    const problemsOf = (tree) => {
      const problems = [];
      collect(tree, (node) => node.kind === 'host').forEach((node) => {
        const props = node.props || {};
        if (props['aria-hidden'] === 'true') return;
        if (node.type === 'button' && nameOf(node) === '') problems.push('unlabeled button');
        if (node.type === 'input' || node.type === 'textarea') {
          const label = typeof props['aria-label'] === 'string' ? props['aria-label'].trim() : '';
          const placeholder = typeof props.placeholder === 'string' ? props.placeholder.trim() : '';
          if (label === '' && placeholder === '') problems.push('unlabeled ' + node.type + '.' + (props.className || ''));
        }
        if (props.role === 'dialog' || props.role === 'alertdialog') {
          if (props['aria-modal'] !== 'true') problems.push('dialog without aria-modal');
          if (nameOf(node) === '') problems.push('unnamed dialog');
        }
      });
      return problems;
    };
    const check = (label, prepare) => {
      const session = mount();
      let tree = renderPanel(session);
      tree = prepare(tree);
      const problems = problemsOf(tree);
      assert(problems.length === 0, label + ': ' + problems.join(', '));
    };
    check('panel', (tree) => tree);
    check('session menu', (tree) => {
      click(byClass(tree, 'cd-item-menu')[0]);
      return rerender();
    });
    check('settings', (tree) => {
      click(byClass(tree, 'cd-settings')[0]);
      return rerender();
    });
    check('delete dialog', (tree) => {
      click(byClass(tree, 'cd-item-menu')[0]);
      tree = rerender();
      click(byClass(tree, 'cd-session-menu-item')[5]);
      return rerender();
    });
    check('find bar', (tree) => {
      click(byClass(tree, 'cd-item')[0]);
      tree = rerender();
      const button = collect(tree, (node) => node.kind === 'host' && node.props['aria-label'] === '查找')[0];
      click(button);
      return rerender();
    });
    check('model menu', (tree) => {
      click(byClass(tree, 'cd-model-chip')[0]);
      return rerender();
    });
    console.log('PASS 33: every surface exposes accessible names');
  }

  /* --- 34. token usage and context occupancy ------------------------------- */
  {
    const session = mount(
      {
        'deepseek-chat-ui.threads.v1': JSON.stringify([
          {
            id: 't-usage',
            title: '带用量的会话',
            updatedAt: 1700000000000,
            messages: [
              { id: 'u1', role: 'user', text: '你好', at: 1700000000000 },
              {
                id: 'a1',
                role: 'assistant',
                text: '你好呀',
                at: 1700000001000,
                usage: { inputTokens: 1000, cacheReadTokens: 200, outputTokens: 356, reasoningTokens: 120 },
              },
            ],
          },
        ]),
      },
      {
        fetch: async (url) => {
          if (String(url).indexOf('/models') >= 0) {
            return {
              ok: true,
              json: async () => ({
                providers: [],
                current: { provider: 'deepseek', model: 'deepseek-chat', contextWindow: 128000 },
              }),
              text: async () => '{}',
            };
          }
          return { ok: true, json: async () => ({}), text: async () => '{}' };
        },
      },
    );
    let tree = renderPanel(session);
    await wait(10);
    tree = rerender();
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();
    const usage = byClass(tree, 'cd-turn-usage')[0];
    assert(usage, 'the assistant turn shows token usage');
    assert(
      textOf(usage).trim() === '↑ 1.2K · ↓ 356',
      'usage reads the billed input and output: ' + textOf(usage),
    );
    assert(
      (usage.props.title || '').indexOf('缓存命中 17%') >= 0 || (usage.props.title || '').indexOf('缓存命中') >= 0,
      'the usage tooltip breaks down the counters: ' + usage.props.title,
    );
    const meter = byClass(tree, 'cd-meter')[0];
    assert(meter, 'the composer shows a context meter');
    assert(textOf(meter).trim() === '1%', 'occupancy is used/contextWindow: ' + textOf(meter));
    assert(
      (meter.props['aria-label'] || '').indexOf('上下文 1%') === 0,
      'the meter is announced with its reading: ' + meter.props['aria-label'],
    );
    console.log('PASS 34: token usage and context occupancy render');
  }

  /* --- 35. usage panels open with exact figures ---------------------------- */
  {
    const session = mount(
      {
        'deepseek-chat-ui.threads.v1': JSON.stringify([
          {
            id: 't-usage',
            title: '带用量的会话',
            updatedAt: 1700000000000,
            messages: [
              { id: 'u1', role: 'user', text: '你好', at: 1700000000000 },
              {
                id: 'a1',
                role: 'assistant',
                text: '你好呀',
                at: 1700000001000,
                usage: { inputTokens: 1000, cacheReadTokens: 200, cacheWriteTokens: 0, outputTokens: 356, reasoningTokens: 120 },
              },
            ],
          },
        ]),
      },
      {
        fetch: async (url) => {
          if (String(url).indexOf('/models') >= 0) {
            return {
              ok: true,
              json: async () => ({
                providers: [],
                current: { provider: 'deepseek', model: 'deepseek-chat', contextWindow: 128000 },
              }),
              text: async () => '{}',
            };
          }
          return { ok: true, json: async () => ({}), text: async () => '{}' };
        },
      },
    );
    let tree = renderPanel(session);
    await wait(10);
    tree = rerender();
    click(byClass(tree, 'cd-item')[0]);
    tree = rerender();

    click(byClass(tree, 'cd-turn-usage')[0]);
    tree = rerender();
    let panel = byClass(tree, 'cd-usage-panel')[0];
    assert(panel, 'the turn usage panel opens');
    const panelText = textOf(panel);
    assert(panelText.indexOf('本轮用量') >= 0, 'the panel is titled 本轮用量');
    assert(panelText.indexOf('未缓存输入') >= 0 && panelText.indexOf('缓存命中') >= 0, 'the panel lists the breakdown');
    assert(panelText.indexOf('17%') >= 0, 'the panel shows the cache-hit share');
    session.emitWindow('keydown', { key: 'Escape' });
    tree = rerender();
    assert(byClass(tree, 'cd-usage-panel').length === 0, 'Escape closes the usage panel');

    click(byClass(tree, 'cd-meter')[0]);
    tree = rerender();
    panel = byClass(tree, 'cd-usage-panel')[0];
    assert(panel, 'the context panel opens');
    assert(textOf(panel).indexOf('上下文用量') >= 0, 'the context panel is titled 上下文用量');
    assert(textOf(panel).indexOf('1%') >= 0, 'the context panel repeats the reading');
    console.log('PASS 35: usage panels open with exact figures');
  }

  console.log('\nALL CHECKS PASSED (' + checks + ' assertions)');
}

main().catch((error) => {
  console.error('\nFAILED after ' + checks + ' assertions');
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
