# Answer Lens 2.0 — implementation and review evidence

Request: `answer-lens-evolution-20260921-round-2`. Delivery scope: **review branch only**, not a deployment, promotion or final acceptance. The canonical public repository is `donizetiferr/answer-lens`, verified through repository node ID `R_kgDOUKWmPA`. Base `origin/main` was `72bc7ab2bf672ff1cfc480a17c5f06597c85d020`. Work was isolated in branch `evolution/answer-lens-20260921`; the original main checkout and the separate compatibility repository were not edited.

## Plan and implementation

The screen plan and task journeys were recorded first under [design_refs/answer-lens-evolution/DESIGN.md](design_refs/answer-lens-evolution/DESIGN.md). Two real baseline captures were made before changing the runtime, with their own manifest. The implementation evolves the existing app rather than replacing it with a mockup.

The required commitment is now the user's verdict. Detailed ratings can be omitted, partially entered or fully entered and remain locked with the verdict/reason before source reveal. Omitted, numeric and Not sure values remain distinct. Navigation moves between full inert answers and the decision; answer-specific headings remain identifiable while reading. Copy actions produce a readable decision note or the explicitly preferred answer, with selected plain-text fallback on clipboard denial. Confirmed question reuse clears all answer-specific data, the old shuffle, synthetic status and persistence consent.

Persistent saving feedback is separate from transient workflow messages. V2 uses `answer-lens.session.v2`, never the v1 key, with browser Web Locks and expected-snapshot checks for cooperating tabs. Other-tab changes preserve this tab's draft, selection and focus while pausing saving. Explicit replacement is checked again under the lock. Older valid data is opened only by an explicit action; future/unreadable data is preserved instead of deleted. Pending saves, clipboard failures and local file reads cannot resurrect a comparison after reset.

## Executed verification

Execution environment: **Node v24.16.0**, **Chrome 151.0.7922.137** on the owner VPS. Selected UI mode was 6 Pro; an actual execution-model identifier was not exposed and is not inferred from that selection.

The final suite consists of **51 isolated Node tests, 5 separate loopback-server tests and 33 actual-browser tests: 89 total**. Final command receipts and durations are recorded in `verification.json` beside this document. None of these checks substitutes for independent acceptance.

| Command | What it actually checks |
| --- | --- |
| `node --permission --allow-fs-read=. scripts/run-gates.mjs` | Single-process Node built-ins and local modules; input/state invariants, optional ratings, source hiding, export/import, deterministic ordering, text outputs, migration and storage conflicts. No network or subprocess APIs are used by these gate files. |
| `node --test tests/server.test.mjs` | Temporary loopback sockets, fixed asset allowlist, headers and rejected uploads; closed in teardown. |
| `node --test --test-concurrency=1 tests/browser.test.mjs tests/evolution.browser.test.mjs` | 13 adapted existing regressions and 20 evolution journeys in real Chrome; isolated contexts and dedicated temporary servers with teardown. |
| Two `node --permission --allow-fs-read=. scripts/demo.mjs` executions, followed by `cmp` | Byte-identical deterministic v2 JSON output. SHA-256 including the newline: `d22757bd1df7a1996cb99b877dcd2a7cc4b3f10d156f19d80edc31b789b9a276`. |

The portable Node 22+ gate command is `node scripts/run-gates.mjs`; the permission flags above describe the observed Node 24 execution. Each gate `test_file` in `buildsignal-gates.json` can also run directly with Node. The demo is a runnable Node program, not HTML. Playwright remains development-only; the browser runtime has no package dependency.

### Specific browser evidence

The browser journeys exercised the required verdict's inline error and actual focus target; zero and partial ratings; optional-section collapse and rating clearing; real clipboard writing/reading in an isolated synthetic test; denied clipboard fallback; actual JSON downloads and local file imports; cancellation and question-only reuse; synthetic labels; malicious-looking text; local saving blocked/quota conditions; no-lock fallback; and an actual offline reload through the app service worker.

Long-text checks used unequal **39,990-character and 14,000-character** synthetic answers at **390x844 and 320x760**. They checked exact text preservation, A/B/decision navigation, header placement, horizontal overflow and 200% CSS root-text enlargement. A keyboard-only journey used Tab, Shift+Tab, Enter and arrow keys from the skip link through the result and fallback, without injecting focus to shortcut the path.

Frozen v1 `core.js` and `storage.js` fixtures are copied from commit `8c1783a35e07294f2eb67cb8840d1b5dfa210b2d`. A real browser harness served those unchanged modules on the **same temporary loopback origin** as v2. Old v1 load/save/reset operations left v2 partial-rating data untouched. Explicit migration left the original v1 bytes untouched with v2 saving off. No production compatibility service or repository was modified for this test.

Cross-tab checks include preserved draft text, selection and focus; competing first saves; a stale confirmation while another tab changes the saved copy again; another-tab reset; and cancellation while a write is queued behind another tab's lock. Delayed clipboard rejection and delayed `File.text()` completion after reset cannot restore old content. An actual beforeunload prompt was observed and dismissed in this Chrome environment; the app does not assume that every browser will show it.

### Failures found and resolved during this round

The first pure run surfaced four old expectations that intentionally changed under the accepted scope: mandatory six ratings, v1-only export schema, rejection of partial v2 ratings, and automatic deletion of unreadable data. Those checks were replaced by explicit new invariants, not removed without coverage. Original safe rendering, seeded ordering, offline reload, consent, input validation and literal-null regressions remain.

The first expanded browser run passed 16 of 18 journeys. It found a genuine 320px enlarged-text overflow in the progress labels and a case-sensitive test expectation for text transformed to uppercase by CSS. The progress grid now reflows without hiding overflow; the assertion uses case-insensitive matching. Visual inspection then found an unfocused skip link leaking over the enlarged navigation because its old fixed negative offset was shorter than its wrapped height. It now hides relative to its own size, with a new actual-browser unobscured-target assertion. Enlarged navigation can use a second row instead of splitting short words. The resulting full suites were rerun rather than assuming the earlier pass still applied.

## Actual captures and visual inspection

[Capture manifest](design_refs/answer-lens-evolution/captures.json) records the real browser version, timestamp, viewport, phase, scenario, PNG SHA-256 and the hashes of the exact runtime files served during capture. Baseline captures and v1 media are separate. See [visual review](design_refs/answer-lens-evolution/visual-review.json) for only the final images actually opened and inspected in this conversation. No generated UI artwork is presented as product evidence.

The browser observation records no app exceptions, third-party requests or outgoing non-GET data requests in the exercised journeys. This is scoped execution evidence, not a proof about arbitrary browser extensions or every possible future input.

## Security, privacy and coverage boundaries

The release audit checks current changed/added files, basic credential patterns, forbidden artifact paths, manifest-to-runtime integrity, fixture provenance and unchanged historical media. Its scope and actual findings are in `verification.json`; it is not a penetration test or a guarantee that all vulnerabilities are absent. Raw command output and machine-local scripts stay in ignored `evidence/` and `*.local.*` files, not in the commit.

This round does **not** claim real screen-reader certification, Safari/Firefox or real mobile-device coverage, native browser zoom testing, full accessibility conformance, or model-performance evidence. The enlargement check changes root text size to 200%; it is not falsely labelled a screen-reader or browser-zoom session. Screen-reader and additional-platform review remain useful independent acceptance work.

The old/new live URL, retired-worker redirect and Pages deployment are controlled by the executor. The same-origin v1/v2 storage compatibility was tested locally with real old code; a final live-route/old-cached-tab smoke check after promotion is still an executor review step, not claimed as already performed on a deployed v2 app.

Saving requires browser Web Lock support to provide this implementation's cooperating-tab serialization. Without it, the app remains usable in the tab and through copy/export but refuses to claim safe device saving. This does not defend against arbitrary code controlling the same origin. Local storage, copied text and exported JSON are unencrypted; records and origins are user-supplied/unsigned. Recognizable answer text can reveal identity. One preference does not establish accuracy or model superiority.

Reset is deliberately not a site-wide wipe: other tabs, older v1 data, unsupported future records, downloads and the clipboard may remain. The UI describes that scope. Unknown records need suitable newer software or browser storage controls, not automatic destructive cleanup. Unsaved work can still be lost if the browser terminates without a warning.

## Historical media and publishing boundary

The tracked six-second v1 preview remains byte-identical: SHA-256 `bb60266ed7c5ba82b693774f88eb2416c9733ade8c708ff88b0eecf068035ce5`. Its successful three-clip, flattened-caption native Studio path is recorded in [historical evidence](evidence.md). The old 18-second pixel-budget refusals are now explicitly labelled historical/superseded, not a current missing renderer. No Studio code, policy, service or media production was changed in this round. **New video is deferred until independent acceptance.**

Only the named evolution branch is authorized for push. Repository publication and rename are historical executor actions, not new actions of this implementation. No main push, deployment, X post, visibility change or force-push belongs to this delivery. A post-push receipt independently compares local HEAD, the live Git remote ref and GitHub's ref response; that machine-local receipt remains outside the commit it verifies.

## Primary references

The prior-art attribution remains in [differentiation.md](differentiation.md): [Chatbot Arena paper](https://arxiv.org/abs/2403.04132). Browser behavior references inspected for this work: [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [storage events](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event), [Clipboard.writeText](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText), and [beforeunload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event). These references explain platform behavior; they are not substitutes for the app's executed tests above.
