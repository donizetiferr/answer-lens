# Build and verification evidence

Job: `buildsignal-answer-lens-20260921`. This is a private implementation for independent release review, not a public launch, a model benchmark, or a claim of scientific double blinding.

The resumed work inspected the existing workspace and receipts before changing files. Git reported **no commits yet on main**. Authenticated repository metadata identified `donizetiferr/livre-10`, owner `donizetiferr`, `private: true`, size 0, default branch `main`; `git ls-remote origin refs/heads/main` returned no branch. The existing implementation was retained, not regenerated.

Selected UI mode was **6 Pro**, as requested by the owner. The actual execution model is not exposed in these build receipts and is not inferred from that selection.

## Executed checks

Environment: Node **v24.16.0**; actual browser **Chrome 151.0.7922.137**. The final browser observation is timestamped **2026-09-21T05:26:07.068Z**.

| Command | Actual outcome |
| --- | --- |
| `node --test --test-name-pattern='conditional sections' tests/browser.test.mjs` before the fix | Exit 1; regression reproduced an actual `#app` text node containing `null` after reveal. |
| `node --permission --allow-fs-read=. scripts/run-gates.mjs` | Exit 0; **33 passed, 0 failed**, 66.496206 ms. |
| `node --test tests/server.test.mjs` | Exit 0; **5 passed, 0 failed**, 222.391542 ms. |
| `node --test tests/browser.test.mjs` after the fix and cache revision | Exit 0; **13 passed, 0 failed**, 16426.785733 ms. |
| Two executions of `node --permission --allow-fs-read=. scripts/demo.mjs`, followed by `cmp` | Exit 0; byte-identical self-contained JSON outputs. |

**51 tests passed across the final three suites.** Earlier counts were rerun rather than treated as evidence of the current tree. None of the final tests was skipped or cancelled. The Node permission flags above describe the actual Node 24 run; the portable Node 22+ gate command is `node scripts/run-gates.mjs`.

The gate runner imports `tests/core.test.mjs`, `tests/storage.test.mjs` and `tests/demo.test.mjs` in its own process. These tests use Node built-ins and local modules only, without network, browser, server, package installation, or child-process APIs. Each listed file is also executable directly with Node. Server and browser tests are explicitly separate in `buildsignal-gates.json`.

The deterministic `demo_file` is **`scripts/demo.mjs`**, a runnable Node program, not HTML. Its complete synthetic result uses a fixed seed, fixed timestamps and scripted ratings. SHA-256 of its standard output, including the final newline:

`4e245768e6e6e04041871e4cdc7f3ae9899b6c304cb580ceebf429a12ac1a0f1`

## Regression and browser scope

The fix filters only `null` and `undefined` at the `replaceChildren` boundary in `src/app.js`. Optional sections are absent instead of stringified. A real browser test covers synthetic setup, blind comparison, reveal, reset, and a non-demo comparison, checking both direct text nodes and the accessibility snapshot. The offline shell cache was revised to `1.0.0-r2` so an earlier cached app can update.

The browser suite exercised the complete synthetic workflow; input errors; source-field absence from the DOM and accessibility snapshot before reveal; required ratings and verdict; safe text rendering of hostile-looking HTML; locked results; a real JSON download and local re-import; opt-in saving; reload; reset; unrelated storage preservation; blocked/corrupt storage; cross-tab reset; keyboard navigation; and an actual offline reload.

Viewport checks used **1440×1000** desktop, **390×844** mobile, and an additional **320px** no-horizontal-overflow check. Observed app exceptions, third-party requests, and non-GET requests were all empty arrays. This is evidence for these exercised flows in this Chrome environment, not a general proof about every browser, extension, or possible input.

## Screenshots actually inspected

The following four new screenshots were opened and visually inspected in the resumed conversation. The desktop captures show readable answer cards and ratings, hidden source fields before reveal, and a clean revealed result without the literal-null artifact. Mobile captures show the rating controls, uncertainty option, responsive result and export button. These are screenshots of the working app, not generated interface artwork. Ratings are scripted test inputs, not a human study.

| Workspace-relative path | SHA-256 |
| --- | --- |
| `media/review-v2/desktop-blind.png` | `17dbc9910bae57d4e30bcd0d25408406a45d5710386b3ac229ade716e1b235ab` |
| `media/review-v2/desktop-result.png` | `dd01dc11f9c5685b30147f0411ca02663e3e322dc4f4a77c63f5b8a9dc45848f` |
| `media/review-v2/mobile-ratings.png` | `554fd4029755adab07f1422ca36a155d6d5466906a3dad4c45ae52cf22fce807` |
| `media/review-v2/mobile-result.png` | `769a2bbb7f186c9b13785f1847da12b6675bd89f7661aac93ff554bb61203a79` |

Earlier screenshots remain unchanged on the VPS. Only these four reviewed screenshots are selected for the repository. Other test captures and raw observations are retained locally, not labelled as separately inspected renders.

## DoniStudio: exact remaining media limitation

The v071 agent guide, a fresh `ops.agent_interface catalog`, the current `ops.edit_graph contract`, and the native plan/frame/render/verify argument contracts were inspected. The catalog digest was `a328f29f628ee173a2e2f34a2dea17cbc5d067ccce7c5b221593225462516463`. Native rendering exists; the failed attempt is **not** evidence that a new production lacks a renderer.

The original 1152×816, 18-second, 24 fps, two-track project and all bound source captures were preserved. Its project SHA-256 is `71fbb601387199e655de903c3d3b8fb45ab1f18160a7321b49997659a0a2a622`. The original CLI receipt already reported `EDIT_PIXEL_WORK_BUDGET`.

A new, create-only revision was written to `media/demo-v2/project.json`: **864×612**, still **18 seconds / 24 fps / 432 frames / two tracks / 12 clips**. Every transform-box coordinate and size was scaled by exactly **3/4**. All source assets were unchanged and checked against their recorded SHA-256 values. New project SHA-256:

`40e570f67fe044db32a7c75b6e5178a876b96c097b1cc85661053a397ff60043`

The actual native command was the existing Studio environment's `python -m ops.edit_graph plan --project <workspace>/media/demo-v2/project.json --output <workspace>/media/demo-v2/plan.json`, run in a new dedicated systemd unit. The unit's own observed properties were **MemoryMax=4294967296**, **CPUQuotaPerSecUSec=2s** (two CPUs), and **TasksMax=256**. No Studio policy was changed.

**Actual terminal result: exit 2, status `BLOCKED`, code `EDIT_PIXEL_WORK_BUDGET`.** Runtime was 1.195 seconds; systemd reported 59.6M peak memory. The current planner's conservative accounting charges source surfaces and composition surfaces for the timeline. Applying that formula to this revision gives **8,147,257,344 pixel-work units**, above the unchanged **1,000,000,000** limit. That number is a calculation from the inspected planner and actual PNG dimensions, not a measured GPU/CPU throughput result. A smaller canvas alone was insufficient.

Before that terminal planner result, setup errors were reconciled: the interactive shell had no user D-Bus environment; system Python lacked Studio's dependencies; and an initially chosen 64-task cap left less than Studio's required 64-task headroom. The existing `.venv-studio` environment and a 256-task dedicated cap resolved those setup issues while preserving the requested 4 GiB / two-CPU caps. No media output existed before correcting those setup errors. No dependency was installed and no production service or policy was modified.

No accepted `plan.json` or plan hash was produced. **Frame, render and verify were therefore not executed**, and there is no finished video or native caption render to claim as reviewed. No pilot was relabelled, no alternative encoder bypassed the budget, and no further creative revision was attempted after the budget refusal. The real software screenshots are the delivered media. English caption source assets and both project revisions remain on the VPS; they are not presented as verified video output.

## Local receipts and delivery boundary

Raw receipts are retained under the workspace's ignored `evidence/` directory: `null-regression-before-v2.txt`, `gates-final-v2.txt`, `server-final-v2.txt`, `browser-final-v2.txt`, `demo-deterministic-v2.json`, `review-v2/browser-observations.json`, and `studio-plan-v2-bounded.local.txt`. The original media, revision metadata, private contract snapshots and transient logs are deliberately excluded from Git. The repository contains this narrow evidence summary, source/tests, MIT license, prior-art documentation and four inspected screenshots.

The dedicated review-server job was stopped by its exact job ID. Integration tests close their own temporary loopback servers and isolated browser contexts. Git delivery is limited to `main` in the assigned private repository, without a force-push or visibility change. The remote commit must be checked independently after pushing; that post-push receipt lives outside the commit it verifies.

## Known limitations

Blinding is only at the interface: a person may recognize pasted content, an answer may identify itself, and local storage can be inspected. Sources are user-entered; confidence is not a fact-check. A single personal preference does not establish model superiority. Local JSON is editable and unsigned; storage is optional, unencrypted and subject to browser clearing or eviction. Offline reload requires the initial successful app-cache installation on the same origin. Reset cannot delete previously downloaded files. Concurrent opted-in tabs use last-write-wins rather than merged editing.

The checks do not establish full accessibility conformance, screen-reader coverage, cross-browser compatibility, penetration-test certification, or general model quality. The optional captioned video remains blocked by the native planner's workload budget. Independent release review is still required; publication is not authorized by these test results.

## Release-file audit

The staged-file audit checked **29 files**, found **zero credential-pattern or prohibited-artifact findings**, and validated the isolated gate entry points and zero runtime dependencies. `git diff --cached --check` exited 0. The local audit receipt includes SHA-256 values for every staged file; its scope is basic credential patterns and release-file hygiene, not a complete security audit. Raw audit scripts and receipts remain outside the Git payload. The dedicated review port, 34889, was also checked with `ss` after stopping its server and had no listening socket.
