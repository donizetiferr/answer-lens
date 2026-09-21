# Answer Lens evolution — screen and journey plan

Request: `answer-lens-evolution-20260921-round-2`. Base: `72bc7ab2bf672ff1cfc480a17c5f06597c85d020`. This plan precedes implementation. Only branch `evolution/answer-lens-20260921` is a delivery target; no deployment or video is part of this round.

## Product shape

Keep the cream / dark-green visual language, system fonts, generous answer cards and native controls. Improve the real task, not a dashboard. The user's verdict is the only required judgment. Origins are never rendered before commitment. Detailed ratings, including subjective factual confidence and Not sure, are optional and immutable after reveal.

## Planned screens

1. **Prepare.** Existing question and two-answer editor, explicit synthetic demo, optional source names. A persistent data-status region above the editor distinguishes unsaved tab data from the offline app shell. An older saved v1 comparison can be opened explicitly, never auto-migrated or destroyed.
2. **Read and decide.** Compact sticky A / B / Your decision navigation; full inert answer text at comfortable size. Source-free answer headers remain identifiable during reading. Native normal page scrolling, no nested scroll boxes, truncation, hidden summaries, or source-bearing navigation. The decision panel contains A / B / tie / neither, an optional reason, and optional detailed ratings in a disclosure. Missing-verdict validation focuses the verdict controls.
3. **Keep and repeat.** Immutable result with Copy decision note, Copy preferred answer (A or B only), JSON export, and Compare another pair for this question. Automatic-copy denial opens selectable plain text without losing the result. A confirmation precedes replacement and retains only the question; old answers, origins, notes, ratings, synthetic status, consent and shuffle do not carry over.
4. **Durability states.** Saved, tab-only, failed save, protected unreadable/newer saved data, and other-tab change are visibly distinct. Other-tab events never replace current text or move focus. Replacing another tab's saved data requires explicit confirmation. Unsupported formats are preserved. Old v1 and new v2 keys are isolated.

## Declared viewports and acceptance journeys

- Desktop: 1440 x 1000. Narrow/mobile: 390 x 844 and 320 x 760. Enlarged text and keyboard operation are separate checks, not screen-reader certification.
- Quick decision: synthetic example -> blind -> choose a verdict with no ratings -> reveal; copy/export; no invented ratings or source leakage.
- Long reading: full unequal-length answers, including near 40,000 characters, -> A/B/decision jumps -> optional ratings; no horizontal overflow or obscured focus.
- Keep and repeat: copy denied fallback -> cancel next pair without changing the result -> confirm -> question-only draft -> fresh shuffle.
- Durable work: save off, save on/reload, storage denied/quota, other-tab updates/reset, and a genuinely old v1 loader alongside v2. No data-erasing upgrade.
- Import: genuine v1 complete result and v2 zero/partial/full ratings; malicious-looking text stays text; imports are already revealed and saving remains off.

## Evidence arrangement

`captures/baseline-*.png` are actual pre-change local-app captures, not proposed UI. `captures/evolution-*.png` will be actual implemented-app captures. A capture manifest binds viewport, phase, provenance and SHA-256. No generated mockups or old screenshots will be passed off as the new implementation. Original v1 media elsewhere in this repository stays historical. New video is deferred until independent acceptance.

## Explicit non-goals

No accounts, model calls, cloud sync, tracking, automatic fact score, leaderboards, history library, rich HTML/Markdown rendering, generated summaries, social publishing or Studio changes. Clipboard and local-storage failures must remain recoverable, not become reasons for more services.

## Implemented screen evidence

The planned journeys now run in the real application. [Final capture manifest](captures.json) binds the served runtime and screenshot bytes; [visual self-review](visual-review.json) records only final PNGs actually opened and inspected. Both are implementation evidence, not independent acceptance.

[Prepare](captures/evolution-desktop-prepare.png) · [Read and decide](captures/evolution-desktop-reading.png) · [Keep the result](captures/evolution-desktop-result.png) · [Mobile result](captures/evolution-mobile-result.png) · [320px enlarged text](captures/evolution-mobile-320-enlarged.png) · [Copy fallback](captures/evolution-copy-fallback.png) · [Question reuse](captures/evolution-repeat-question.png) · [Save failure](captures/evolution-save-failure.png)
