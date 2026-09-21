// Reproduce the current catalog prototype from the root app. No packages or subprocesses.
// --check is read-only; --write touches only the named collection's generated files.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const COLLECTION = 'docs/design_refs/answer-lens';
export const PREVIEW = Object.freeze({
  storageKey: 'answer-lens.preview.session.v2',
  legacyKey: 'answer-lens.preview.session.v1',
  lockName: 'answer-lens-preview-device-v2'
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = data => JSON.stringify(data, null, 2) + '\n';
// Declare existing local handlers for the catalog viewer without changing behavior.
export function annotateLocalActions(text) {
  return text.replace(/<button\b([^>]*\bid="([^"]+)"[^>]*)>/g,
    (_tag, attributes, id) => `<button data-acao="${id}"${attributes}>`)
    .replace(/<a\b([^>]*\bhref="#([^"]+)"[^>]*)>/g,
      (_tag, attributes, anchor) => `<a data-acao="scroll-${anchor}"${attributes}>`);
}
export function annotatePreviewApp(text) {
  return once(text, '  return node;', `  if (tag === 'button' || (tag === 'a' && String(attrs.href || '').startsWith('#'))) {
    node.dataset.acao = attrs.id || (tag === 'a' ? 'scroll-comparison' : 'comparison-action');
  }
  return node;`);
}
function once(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Preview adaptation no longer matches exactly: ${from}`);
  return text.replace(from, to);
}
export async function expectedPrototype(root = ROOT) {
  const sourceNames = ['index.html', 'styles.css', 'icon.svg', 'sw.js', 'src/app.js', 'src/core.js', 'src/storage.js', 'src/demo.js', 'src/output.js'];
  const source = new Map(await Promise.all(sourceNames.map(async path => [path, new TextDecoder('utf-8', { fatal: true }).decode(await readFile(join(root, path)))])));
  const sourceHashes = Object.fromEntries([...source].map(([path, text]) => [path, hash(text)]));
  const sourceTreeSha256 = hash(json(sourceHashes));
  const appVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const output = new Map(source);
  let storage = source.get('src/storage.js');
  for (const [from, to] of [
    ["export const STORAGE_KEY = 'answer-lens.session.v2';", `export const STORAGE_KEY = '${PREVIEW.storageKey}';`],
    ["export const LEGACY_KEY = 'answer-lens.session.v1';", `export const LEGACY_KEY = '${PREVIEW.legacyKey}';`],
    ["export const LOCK_NAME = 'answer-lens-device-v2';", `export const LOCK_NAME = '${PREVIEW.lockName}';`]
  ]) storage = once(storage, from, to);
  output.set('src/storage.js', storage);
  const banner = '<aside class="notice wrap" aria-label="Isolated catalog preview"><strong>Isolated preview</strong> · This is the working app with separate demo storage. It never opens the main app’s saved comparison. Saving and reset apply only to this preview.</aside>';
  const html = annotateLocalActions(once(source.get('index.html'), '  <main id="main"', `  ${banner}\n  <main id="main"`));
  output.set('src/app.js', annotatePreviewApp(source.get('src/app.js')));
  for (const path of ['index.html', 'comparison.html', 'mobile.html']) output.set(path, html);
  let sw = once(source.get('sw.js'), 'answer-lens-shell:', 'answer-lens-preview-shell:');
  sw = once(sw, "'./index.html',", "'./index.html', './comparison.html', './mobile.html',");
  // Cache the isolated bytes, not a previously cached v1 catalog copy.
  sw = once(sw, `\${PREFIX}${appVersion}`, `\${PREFIX}${appVersion}-catalog-r3-review`);
  output.set('sw.js', sw);
  const resources = ['styles.css', 'icon.svg', 'sw.js', 'src/app.js', 'src/core.js', 'src/storage.js', 'src/demo.js', 'src/output.js'];
  const metadata = JSON.parse(await readFile(join(root, COLLECTION, 'prancheta.json'), 'utf8'));
  // Preserve the existing collection, start path, journey ID, screen ID, and design profile.
  if (metadata.colecao.inicio !== 'comparison.html' || metadata.telas['comparison.html']?.idTela !== 'answer-lens:comparison' || !metadata.colecao.jornadas.some(j => j.id === 'compare')) {
    throw new Error('Collection identity changed; reconcile instead of regenerating IDs.');
  }
  Object.assign(metadata.colecao, {
    descricao: 'Protótipo atual do aplicativo 2.0: ler respostas completas sem nomes, decidir com notas opcionais, revelar, copiar, exportar/importar e comparar outro par. Armazenamento de demonstração isolado do aplicativo principal.',
    finalidade: 'atual', versaoDoProduto: appVersion,
    fonteDaVersao: { arquivo: 'package.json', campo: 'version' }
  });
  const desktop = metadata.colecao.jornadas.find(j => j.id === 'compare');
  Object.assign(desktop, { titulo: 'Ler, decidir e reutilizar — desktop', inicio: 'comparison.html', dispositivo: 'desktop', descricao: '1440×1000. Fluxo completo com decisão obrigatória, notas opcionais, cópia e novo par para a mesma pergunta.' });
  const mobile = { id: 'compare-mobile', titulo: 'Ler, decidir e reutilizar — celular', inicio: 'mobile.html', dispositivo: 'smartphone', descricao: '390×844. Mesmo aplicativo funcional, com navegação A/B/decisão, respostas completas e controles locais.' };
  const oldMobile = metadata.colecao.jornadas.find(j => j.id === mobile.id);
  if (oldMobile) Object.assign(oldMobile, mobile); else metadata.colecao.jornadas.push(mobile);
  const common = {
    tipo: 'prototipo', capacidade: 'interacao-local',
    estado: 'preparação; leitura A/B; decisão; cópia; próximo par; salvamento isolado',
    origem: `Aplicativo raiz ${appVersion}; SHA-256 do conjunto fonte ${sourceTreeSha256}. Adaptações de preview documentadas em resources.json.`,
    build: appVersion, recursos: resources
  };
  // These are actual journeys, not synthetic state-selector handlers.
  for (const file of ['comparison.html', 'mobile.html']) if (metadata.telas[file]) delete metadata.telas[file].cenarios;
  Object.assign(metadata.telas['comparison.html'], common, { viewport: { largura: 1440, altura: 1000 }, dispositivo: 'desktop' });
  metadata.telas['mobile.html'] = { ...metadata.telas['mobile.html'], ...common, idTela: 'answer-lens:comparison-mobile', titulo: 'Comparar, escolher e revelar — celular', viewport: { largura: 390, altura: 844 }, dispositivo: 'smartphone' };
  output.set('prancheta.json', json(metadata));
  output.set('resources.json', json({
    schema: 'answer-lens-preview-resources/1', appVersion, sourceTreeSha256, sourceHashes,
    isolation: PREVIEW,
    adaptations: [
      'HTML aliases index.html, comparison.html and mobile.html all run the same root app, with a visible isolated-preview notice.',
      'Only the three constants STORAGE_KEY, LEGACY_KEY and LOCK_NAME differ in storage.js. Preview never reads, writes or removes the production keys.',
      'The service worker has a preview-only cache prefix/version and caches all three HTML entry points within its own scope.',
      'HTML and app.js add data-acao declarations to existing local buttons and fragment links for the catalog viewer; handlers and behavior are unchanged.',
      'core.js, output.js, demo.js, CSS and icon bytes otherwise match the root app. resources.json is build metadata, not a runtime resource. No additional runtime dependency.'
    ],
    generatedHashes: Object.fromEntries([...output].map(([path, text]) => [path, hash(text)])),
    hashScope: 'All generated files except this self-describing manifest. Source hashes bind current root bytes; no Git or wall-clock input is required.'
  }));
  return output;
}
export async function syncPrototype({ write = false, root = ROOT } = {}) {
  const expected = await expectedPrototype(root); const drift = [];
  for (const [path, content] of expected) {
    const destination = join(root, COLLECTION, path);
    let actual; try { actual = await readFile(destination, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (actual !== content) {
      drift.push(path);
      if (write) { await mkdir(dirname(destination), { recursive: true }); await writeFile(destination, content); }
    }
  }
  if (drift.length && !write) throw new Error(`Prototype drift: ${drift.join(', ')}. Review root changes, then run node scripts/sync-prototype.mjs --write.`);
  return { checked: expected.size, updated: write ? drift : [], mode: write ? 'write' : 'check' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length > 1 || args.some(arg => !['--check', '--write'].includes(arg))) throw new Error('Usage: node scripts/sync-prototype.mjs [--check|--write]');
    console.log(JSON.stringify(await syncPrototype({ write: args[0] === '--write' })));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
