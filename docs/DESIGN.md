# Answer Lens design

## Current navigable collection

The existing **`design_refs/answer-lens/`** collection is the current **2.0.0 review-branch prototype**, not a historical v1 copy. It runs the root application's actual prepare → read → decide → reveal → copy → next-pair workflow. Promotion to the public website is a separate executor action.

The stable `comparison.html` entry, journey ID **`compare`**, screen ID **`answer-lens:comparison`**, `index.html` alias, collection folder and `answer-lens-claro` design profile are preserved. `mobile.html` is an additional entry to the same functional application, not a screenshot or a second implementation.

| Journey | Entry | Declared viewport | Collection device |
| --- | --- | --- | --- |
| Read, decide, copy and repeat — desktop | [comparison.html](design_refs/answer-lens/comparison.html) | 1440×1000 | `desktop` |
| Read, decide, copy and repeat — mobile | [mobile.html](design_refs/answer-lens/mobile.html) | 390×844 | `smartphone` |

Both entries start in preparation. Load the clearly labelled synthetic demo or enter a question and two answers. Full-answer navigation, optional ratings, required verdict/focus, immutable reveal, copying with selectable-text fallback, real JSON export/import, reset, same-question continuation and optional device saving are functional. The catalog exposes these actual journeys; no synthetic scenario selector is declared without a handler. The coverage inventory is `docs/design_refs/superficies.json`.

Run from the repository root:

```sh
node scripts/sync-prototype.mjs --check
node scripts/serve-prototype.mjs
```

Open `http://127.0.0.1:4181/docs/design_refs/answer-lens/comparison.html` or `http://127.0.0.1:4181/docs/design_refs/answer-lens/mobile.html`. The dedicated review server exposes only the fixed root-app and prototype asset allowlists. It binds to loopback; stop it with Ctrl+C. HTML modules need HTTP or HTTPS, not double-clicked `file://` pages.

## Narrow preview adaptations

The Prancheta viewer runs in an opaque sandbox, where native form submission, service workers, storage and downloads can be unavailable. In that context only, preview submit buttons and Enter invoke the existing local handlers directly. JSON export offers selected copyable text, and the worker getter is not accessed. The viewer's permissions are unchanged; the standalone preview retains its normal forms, storage, downloads and offline behavior.

The visible **Isolated preview** notice is deliberate. Root and prototype can share a hosting origin, so URL paths alone are not used as a data boundary.

| Resource | Root app | Current preview |
| --- | --- | --- |
| Saved comparison | `answer-lens.session.v2` | `answer-lens.preview.session.v2` |
| Legacy comparison | `answer-lens.session.v1` | `answer-lens.preview.session.v1` |
| Web Lock | `answer-lens-device-v2` | `answer-lens-preview-device-v2` |
| Cache namespace | `answer-lens-shell:` plus scope path | `answer-lens-preview-shell:` plus scope path |

Only the three storage/lock constants differ in the preview storage module. The preview neither reads nor writes the real application's keys. Legacy migration, when a preview-specific v1 record exists, only reads that preview record and still requires explicit opening and separate saving consent. It never automatically imports a saved comparison from the main app.

The three HTML entries receive the same visible preview notice. Existing buttons and fragment links receive `data-acao` declarations, including dynamic controls created by the preview's DOM factory; their existing handlers remain unchanged. The service worker receives a preview-specific cache namespace/version and caches all three HTML aliases in its own directory. Its scope cannot control the root app. The core, output and demo modules, stylesheet and icon otherwise match the root bytes. No external scripts, fonts, accounts or network service are added. Product version metadata reads the root `package.json`; `resources.json` is a build manifest rather than a runtime fixture.

This is isolation enforced by the supplied application code, not separate-origin security against arbitrary code running on the same origin. Storage is still unencrypted. A visitor who explicitly selects a result JSON is choosing to open that file locally in the preview.

## Reproducible synchronization

After an intentional root-app change, review and run:

```sh
node scripts/sync-prototype.mjs --write
node scripts/sync-prototype.mjs --check
```

The write operation is restricted to the known generated files in the same collection. The check is read-only and fails on drift. It requires the existing IDs and narrow source-code adaptation anchors to match; it does not silently invent a replacement collection. The [local resource manifest](design_refs/answer-lens/resources.json) binds source files, generated files, isolation names and product version with SHA-256 values. Text line endings are pinned to LF for reproducible Windows/Linux checks. No internal machine path, Git command, network or package dependency is needed by this script.

[Round-3 evidence](prototype-evidence.md) records the actual full journeys, same-origin data isolation and visual inspection. The [evolution screen plan](design_refs/answer-lens-evolution/DESIGN.md), baseline v1 captures and earlier release media remain unchanged historical evidence. New video remains deferred until independent acceptance.

## Visual direction

A quiet local comparison tool: readable complete answers, clear A/B/decision navigation, visible saving status, and a distinction between personal preference and verified accuracy. System fonts, cream background and dark green controls; no replacement of native controls with decorative mockups.

```yaml
perfil: answer-lens-claro
cores:
  fundo: "#f6f5ef"
  tinta: "#203332"
  acento: "#2d604b"
fontes: [system-ui]
raios: [10]
```
