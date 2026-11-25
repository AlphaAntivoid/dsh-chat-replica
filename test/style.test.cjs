/**
 * Stylesheet checks for client.js.
 *
 * The plugin ships one template-literal stylesheet, and two mistakes are easy to
 * make by hand and invisible until runtime:
 *   1. a class used from JS but never defined — a silently dead control;
 *   2. a class with two base rules — the later rule silently overrides the
 *      earlier one (this actually happened once with `.cd-pill`, where a new
 *      button class collided with the floating header capsule).
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'client.js'), 'utf8');
const start = SOURCE.indexOf('const CSS = `');
const end = SOURCE.indexOf('`;', start);
if (start < 0 || end < 0) {
  console.error('FAIL: the stylesheet template literal was not found in client.js');
  process.exit(1);
}
const CSS = SOURCE.slice(start, end);
const JS = SOURCE.slice(0, start) + SOURCE.slice(end);

/** Every class mentioned anywhere in the stylesheet. */
function cssClasses(css) {
  const set = new Set();
  for (const match of css.matchAll(/\.(cd-[a-z0-9-]+)/g)) set.add(match[1]);
  return set;
}

/** Every `cd-*` token that appears inside a JS string literal. */
function usedClasses(js) {
  const set = new Set();
  for (const match of js.matchAll(/'[^'\n]*'/g)) {
    if (!match[0].includes('cd-')) continue;
    for (const token of match[0].slice(1, -1).split(/[^a-z0-9-]+/)) {
      if (/^cd-[a-z0-9-]+$/.test(token)) set.add(token);
    }
  }
  return set;
}

/** Drop `@media ... { ... }` blocks so responsive overrides are not base rules. */
function stripMedia(css) {
  let out = '';
  let index = 0;
  for (;;) {
    const at = css.indexOf('@media', index);
    if (at < 0) {
      out += css.slice(index);
      return out;
    }
    out += css.slice(index, at);
    const open = css.indexOf('{', at);
    if (open < 0) return out;
    let depth = 0;
    let cursor = open;
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    index = cursor + 1;
  }
}

/**
 * Classes that start a top-level rule, i.e. selectors shaped `.cd-x` or
 * `.cd-x,...`. Descendant and pseudo rules such as `.cd-x:hover .cd-y` are not
 * base rules and do not count.
 */
function baseRuleClasses(css) {
  const found = [];
  let depth = 0;
  let buffer = '';
  for (const char of css) {
    if (char === '{') {
      if (depth === 0) {
        const selector = buffer.trim();
        const match = selector.match(/^\.(cd-[a-z0-9-]+)(?:,.*)?$/);
        if (match) found.push(match[1]);
      }
      depth += 1;
      buffer = '';
    } else if (char === '}') {
      depth = Math.max(0, depth - 1);
      buffer = '';
    } else if (depth === 0) {
      buffer += char;
    }
  }
  return found;
}

const defined = cssClasses(CSS);
const used = usedClasses(JS);
const failures = [];

const undefinedClasses = [...used].filter((name) => !defined.has(name)).sort();
if (undefinedClasses.length > 0) {
  failures.push('classes used from JS but never styled: ' + undefinedClasses.join(', '));
}

const counts = new Map();
for (const name of baseRuleClasses(stripMedia(CSS))) {
  counts.set(name, (counts.get(name) || 0) + 1);
}
const duplicated = [...counts.entries()]
  .filter(([, count]) => count > 1)
  .map(([name, count]) => name + ' (' + count + ' base rules)');
if (duplicated.length > 0) {
  failures.push('classes with more than one base rule: ' + duplicated.join(', '));
}

if (failures.length > 0) {
  console.error('FAIL: stylesheet checks');
  for (const failure of failures) console.error('  - ' + failure);
  process.exit(1);
}

console.log(
  'PASS: stylesheet — ' + defined.size + ' classes defined, ' + used.size +
  ' referenced from JS, no duplicates among ' + counts.size + ' base rules',
);
