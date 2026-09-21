# Round 3 — current prototype and stress-review evidence

Scope: `ANSWER_LENS_EVOLUTION_20260921`, round 3, on `evolution/answer-lens-20260921`, based on accepted commit `78a25c0caba6c6553845cbcb30b5b3bbaf0e8626`. This is branch evidence for independent review, not a deployment or a release-approval claim.

## Material finding and bounded change

The existing `design_refs/answer-lens/prancheta.json` still said `finalidade=atual` and `build=1.0.0`, while its executable files were v1 and `DESIGN.md` called them historical. That mismatch is corrected in the same collection. The original folder, `comparison.html`, `index.html`, journey `compare` and screen `answer-lens:comparison` remain. The collection now runs v2, with the additional `mobile.html` journey and explicit 1440×1000 desktop / 390×844 smartphone metadata.

No additional material workflow defect was identified in the exercised read → decide → copy → next-pair journeys. Root HTML, CSS, service worker and all five source modules are unchanged from the accepted commit. The working v1-to-v2 upgrade implementation was not rewritten. The final byte audit did identify one concrete asset defect: the existing `icon.svg` was six non-SVG bytes. An actual browser image-decode regression failed before repair. It was replaced with a valid local 48×48 SVG at the same URL, and the regression verifies both root and preview assets. The sync script now rejects invalid UTF-8 rather than hashing replacement characters. This is an asset repair, not a new product feature.

The executor's previously reported Windows Node 22.22.2 gate run and real cached-v1 migration on localhost:4199 are independent evidence supplied to this round; they are not claimed as executions performed here. This round independently exercises preview-specific isolation while keeping the accepted root implementation intact.

## Navigable artifact, not just captures

[Current desktop prototype](design_refs/answer-lens/comparison.html) and [current mobile prototype](design_refs/answer-lens/mobile.html) execute the same application. Run `node scripts/serve-prototype.mjs` to exercise them through a dedicated loopback-only server. [Design documentation](DESIGN.md) contains the exact entry URLs and narrow adaptations.

`node scripts/sync-prototype.mjs --check` is read-only. `--write` regenerates only the named collection's files. Exact adaptation anchors and the existing IDs are checked before writing. [resources.json](design_refs/answer-lens/resources.json) binds the root source hashes, generated resources, product version and preview isolation constants. LF attributes make the text hashes reproducible across Windows/Linux checkouts.

The metadata was validated with the installed `colecao.v1.schema.json`, digest `3fa877b8ece6830b54f6a945b8b8f64b1f3b477b0843c33a1e49fc65d10e7ea7`. It uses the contract's `desktop` and `smartphone` values, declared viewports and local resource lists. No catalog service or production configuration was changed.

## What the browser journeys establish

Both declared viewport journeys load the synthetic example, read full answers via A/B/decision navigation, reject a missing verdict with focus at the choice, reveal only after commitment, copy a decision and preferred answer, expose selectable text on clipboard denial, download a real result JSON, cancel and confirm next-pair replacement, and re-import the result locally. The mobile path also retains a partial optional rating. Revealed results remain locked; the next pair carries only the question.

The same browser origin contains a saved root v2 comparison and a separate root v1 record during preview tests. Their bytes remain identical through the preview's full journey. Instrumented storage calls demonstrate that the preview does not even read the root keys. A preview-only legacy record can be opened explicitly, keeps its assignment, and requires separate saving consent. Holding the root Web Lock does not prevent preview saving. Editing the root tab preserves the preview draft, selection, focus and saved status.

All three preview entry URLs are cached and exercised after actual offline navigation. The preview cache contains only preview-scope asset URLs, its worker does not control the root application, and preview reset does not remove root data or root caches. A real clipboard-success path is separate from the deliberately denied-permission path.

The existing root browser suite also reruns the keyboard-only journey; 320/390px long text and enlarged text; missing-verdict focus; partial ratings; malicious-looking text; save denial/quota; cross-tab stale confirmations; late clipboard responses; delayed imports; reset with a queued save; actual offline reload; and immutable reveal. No score, leaderboard, account, tracking or model API was added.

## Evidence handling and execution limits

The [round-3 verification record](prototype-verification.json) records final commands/results, runtime equality, actual capture hashes and visual inspection. Earlier tracked media and the v1 baseline remain byte-for-byte unchanged. Normal browser test runs now write ignored evidence rather than replacing the committed round-2 captures. Committed prototype captures require an explicit `ANSWER_LENS_PROTOTYPE_CAPTURE_DIR` override and separate visual review.

Initial browser attempts encountered worker-job thread-creation failures (`pthread_create: Resource temporarily unavailable`). Tests were rerun in a new project-only systemd unit with bounded CPU, memory and tasks; effective limits are read from its own cgroup in the receipt. No shared service limit or Studio policy was changed. The isolation harness explicitly waits for the root shell's initial successful cache installation before reloading its saved fixture; it does not treat an interrupted first installation as an established cached-app scenario. Failed-attempt receipts remain in ignored local evidence, not relabelled as passes.

Actual coverage is Chrome on the VPS, keyboard interaction, DOM/accessibility-tree assertions, CSS text enlargement and inspected screenshots. This is not screen-reader certification, native browser-zoom certification, physical-device testing, cross-browser certification or a live catalog deployment test. Isolation is enforced by the supplied code's namespaces, not by a separate origin against arbitrary same-origin scripts. Browser storage remains unencrypted, clipboard/downloaded copies remain outside reset, and preferences remain subjective.

No main push, public deployment, compatibility-repository edit, new video, X post, paid service or Studio modification is part of this round. Selected UI mode remains 6 Pro; no actual execution-model identifier is inferred.

## Final executed outcomes

Environment: **Node v24.16.0 / Chrome 151.0.7922.137**. Final browser captures and observations are bound by hashes in `prototype-verification.json`. The root workflow review did not justify new features or a storage rewrite; the concrete additions are the synchronized isolated prototype, drift checks and repaired favicon asset.

| Command | Actual result |
| --- | --- |
| `node --permission --allow-fs-read=. scripts/run-gates.mjs` | Exit 0; 59 passed, 0 failed; 138.5131 ms. |
| `node --test tests/server.test.mjs` | Exit 0; 5 passed, 0 failed; 197.261975 ms. |
| `node --test --test-concurrency=1 tests/browser.test.mjs tests/evolution.browser.test.mjs tests/prototype.browser.test.mjs` | Exit 0; 41 passed, 0 failed; 53935.884774 ms. Includes 33 existing root checks and 8 prototype/asset checks. |
| `node --permission --allow-fs-read=. scripts/sync-prototype.mjs --check` | Exit 0; all 13 generated collection files match. |
| Two permission-restricted `scripts/demo.mjs` executions and `cmp` | Exit 0; identical JSON, SHA-256 `d22757bd1df7a1996cb99b877dcd2a7cc4b3f10d156f19d80edc31b789b9a276`. |
| Actual browser favicon-decode regression before the asset repair | Exit 1; decode returned null rather than 48×48 dimensions. The same assertion passes for root and preview in the final run. |

No final test was skipped or cancelled. The isolated gate command is portable as `node scripts/run-gates.mjs` on Node 22+; the permission flags above describe this actual Node 24 execution.

Five final current-prototype screenshots were opened and visually inspected: desktop reading/result, mobile reading/result and denied-copy fallback. Two new root captures were also inspected: 320px enlarged reading and the persistent not-saved result. The repaired SVG was independently decoded and opened as an actual browser image. The review notes describe what is visible, not merely that screenshot generation succeeded.

All **19 pre-existing PNG/MP4 files** remain byte-identical to the accepted base. The eight root HTML/CSS/worker/source files remain unchanged; `icon.svg` is the sole root app asset repair. This review does not replace independent acceptance or authorize promotion.

## Release-file check

The staged review inspected 35 changed files and scanned 83 tracked files for basic credential patterns, with no findings. Staged bytes matched the working tree, local documentation links resolved, `git diff --cached --check` exited 0, all eight unchanged root behavior files matched the accepted base, and all 19 historical PNG/MP4 files and reviewed capture hashes matched. The bounded audit receipt is retained in ignored `evidence/round3/release-audit.local.json`; it is not a complete security audit.
