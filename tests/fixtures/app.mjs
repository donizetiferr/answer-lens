// Execute the real app handlers in Node. This small DOM substitute tests state
// and async control flow only; it provides no layout or browser certification.
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import * as core from '../../src/core.js';
import * as storage from '../../src/storage.js';
import * as output from '../../src/output.js';
import { demoSession } from '../../src/demo.js';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.attributes = new Map();
    Object.assign(this, { id: '', className: '', value: '', name: '', type: '', hidden: false, checked: false,
      disabled: false, open: false, dataset: {}, style: { setProperty() {} } });
  }
  append(...children) {
    for (const child of children) { child.parent = this; this.children.push(child); }
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  set textContent(text) { this.replaceChildren(new Text(String(text))); }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? this[key] ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }
  async fire(type, extra = {}) {
    const event = { target: this, preventDefault() {}, ...extra };
    await Promise.all((this.listeners.get(type) || []).map(handler => handler(event)));
  }
  focus() { this.document.activeElement = this; }
  select() { this.selectionStart = 0; this.selectionEnd = this.value.length; }
  showModal() { if (this.open) throw new Error('Dialog already open'); this.open = true; }
  close() { this.open = false; }
  scrollIntoView() {}
  getBoundingClientRect() { return { height: 0 }; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  click() { return this.fire('click'); }
}
class Text {
  constructor(text) { this.textContent = text; }
}
function descendants(node) {
  return node.children.flatMap(child => child instanceof Element ? [child, ...descendants(child)] : []);
}
function matches(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.className.split(' ').includes(selector.slice(1));
  const [, tag, key, value] = /^(\w+)(?:\[(\w+)=["']?([^"'\]]+)["']?\])?$/.exec(selector) || [];
  return node.tagName.toLowerCase() === tag && (!key || String(node.getAttribute(key)) === value);
}
export const settleApp = () => new Promise(setImmediate);
export function controlledLocks() {
  const pending = [];
  return {
    pending,
    request(_name, action) { return new Promise(resolve => pending.push({ action, resolve })); },
    async release() {
      const lock = pending.shift(); if (!lock) throw new Error('No pending lock to release.');
      lock.resolve(await lock.action()); await settleApp();
    },
    async drain() { while (pending.length) await this.release(); }
  };
}
export async function appFixture({ initial = null, legacy = null, clipboard = null, locks = { request: async (_name, action) => action() } } = {}) {
  const document = {
    createElement(tag) { const node = new Element(tag); node.document = document; return node; },
    createTextNode: text => new Text(text),
    querySelectorAll(selector) {
      let parents = [document.documentElement];
      for (const part of selector.split(' ')) parents = parents.flatMap(parent => descendants(parent).filter(node => matches(node, part)));
      return parents;
    },
    querySelector(selector) { return document.querySelectorAll(selector)[0] || null; }
  };
  document.documentElement = document.createElement('html');
  document.body = document.createElement('body'); document.documentElement.append(document.body);
  for (const id of ['app', 'status', 'error', 'data-status', 'save-retry', 'reset-button', 'reset-dialog', 'reset-heading', 'reset-description', 'confirm-reset', 'cancel-reset', 'offline-status']) {
    const node = document.createElement('div'); node.id = id; document.body.append(node);
  }
  const data = new Map(initial === null ? [] : [[storage.STORAGE_KEY, initial]]);
  if (legacy !== null) data.set(storage.LEGACY_KEY, legacy);
  const localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const window = new Element(); window.scrollTo = () => {};
  const source = await readFile(new URL('../../src/app.js', import.meta.url), 'utf8');
  runInNewContext(source.replace(/^import .+;\n/gm, ''), {
    ...core, ...storage, ...output, demoSession, document, localStorage, window, navigator: { locks, clipboard },
    // Module functions retain their own realm's default arguments. Bind reads
    // explicitly so they never use Node's global localStorage outside this VM.
    loadLocal: () => storage.loadLocal(() => localStorage),
    loadLegacy: () => storage.loadLegacy(() => localStorage),
    Node: Element, structuredClone, crypto: globalThis.crypto, URL, Blob, setTimeout, clearTimeout
  });
  return {
    document, data, localStorage, window,
    get: selector => document.querySelector(selector),
    async input(selector, value) { const node = document.querySelector(selector); node.value = value; await node.fire('input'); },
    async chooseFile(file) {
      const node = document.querySelector('#import-file');
      const value = `/fakepath/${file.name}`;
      if (node.value === value) return false; // Native inputs do not change for the same selection.
      node.value = value; node.files = [file]; await node.fire('change'); return true;
    }
  };
}
