# Differentiation and prior art

## What this tool is for

Answer Lens is a personal worksheet for an ordinary AI user asking: “Which of these two answers would actually help me?” It accepts existing text instead of asking the user to connect a model, buy credits, or understand an evaluation framework.

The intended flow is one concrete question, two answers, a recorded A/B shuffle, a required personal verdict locked before source reveal, optional detailed ratings, and readable/portable results. A next pair can reuse the question after explicit replacement confirmation. There is no automatic winner, factual-accuracy score, leaderboard, account, remote submission, or model call.

## Prior art, credited rather than claimed

Blind pairwise comparison and human preference evaluation are not inventions of this project. A relevant published example is Wei-Lin Chiang and colleagues, *Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference*, submitted March 7, 2024, arXiv:2403.04132: https://arxiv.org/abs/2403.04132 . The paper describes crowdsourced pairwise comparisons and statistical aggregation for evaluating and ranking models. This attribution refers to that paper, not a claim about every feature of the current Arena website.

Answer Lens uses the general idea of hiding names until after a preference. It does not reproduce Arena's code, assets, branding, datasets, or model answers. The app's code, visual design, icon, and synthetic teaching examples were written for this project. No affiliation or endorsement is implied. This is not an exhaustive prior-art or patent search.

## The specific product choices

**A local paste-first workflow.** The user brings two answers they already have. The app does not generate answers, collect votes, or require access to a particular model. It runs from local files served over loopback; an app-only service worker allows later offline reloads.

**Verdict first; detail when useful.** The user can prefer A, prefer B, choose a tie, or choose neither without completing a questionnaire. Usefulness, clarity and factual confidence remain available as optional separate judgments. “Not rated” means omitted, not zero or uncertainty; “Not sure” is an explicit confidence choice. No sum or average selects a winner and no confidence rating becomes verified accuracy.

**A visible commitment point.** Source fields are removed from the rendered comparison page. A verdict must exist before reveal; that verdict, the reason and any supplied ratings lock together. The revealed judgment is read-only. There is no hidden reroll, score editing after reveal, or claim that this commitment is cryptographically enforced.

**A complete, inspectable local record.** The JSON includes full texts, original input order, source names, A/B mapping, seed, algorithm version, timestamps, ratings, verdict, note, synthetic-demo flag, and interpretation caveats. V2 accepts omitted ratings without manufacturing data; genuine v1 imports retain the old format's completeness rules before explicit upgrade. Import checks consistency, not authenticity. Imported results are visibly already revealed and do not imply a new blind trial.

**Useful takeaways and safe repetition.** A readable decision note can be copied into ordinary notes, and a chosen answer can be copied without a file-format lesson. Clipboard denial has a selectable plain-text fallback. Reusing the question requires confirmation and keeps none of the old answer-specific data; it is not a model leaderboard or a saved-results dashboard.

**Local durability without silent replacement.** V2 uses an isolated storage key, optional saving, serialized cooperating-tab writes and stale-snapshot checks. Other-tab changes preserve the current draft and focus while pausing its saving. Old or unsupported data is not auto-deleted. This is a narrow safeguard, not encrypted storage or collaboration.

**Small, accessible controls.** Plain English, native keyboard-operable form controls, visible focus, a skip link, clear errors, full-answer A/B/decision navigation, responsive single-column mobile cards, and an explicit reset make this a practical task tool rather than an evaluation dashboard shell. Recorded checks cover Chrome, keyboard interactions, and 320/390px layouts; they are not a full accessibility certification.

## Where the distinction stops

Interface hiding is not scientific double blinding. Someone who pasted an answer may recognize it; an answer may identify its source; the device owner can inspect local data. No text is silently rewritten to conceal these clues. User-supplied source names are not authenticated.

One person's preference on one question does not show that a model is generally better. The project has no representative question set, recruited evaluator panel, repeated-trial protocol, calibrated truth labels, or aggregate ranking method. The synthetic example is an instructional contrast, not evidence about real models.

Data is local, not encrypted. The v1 source/media/design references remain historical; the new screen plan and actual captures are under `design_refs/answer-lens-evolution`. Device access, extensions, browser storage eviction, and exported-file sharing remain the user's responsibility. The differentiation is the combination and presentation of a bounded personal workflow, not a claim that no other tool offers similar features.
