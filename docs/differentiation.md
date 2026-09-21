# Differentiation and prior art

## What this tool is for

Answer Lens is a personal worksheet for an ordinary AI user asking: “Which of these two answers would actually help me?” It accepts existing text instead of asking the user to connect a model, buy credits, or understand an evaluation framework.

The intended flow is one concrete question, two answers, a recorded A/B shuffle, six human ratings, a verdict locked before source reveal, and a portable result file. There is no automatic winner, factual-accuracy score, leaderboard, account, remote submission, or model call.

## Prior art, credited rather than claimed

Blind pairwise comparison and human preference evaluation are not inventions of this project. A relevant published example is Wei-Lin Chiang and colleagues, *Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference*, submitted March 7, 2024, arXiv:2403.04132: https://arxiv.org/abs/2403.04132 . The paper describes crowdsourced pairwise comparisons and statistical aggregation for evaluating and ranking models. This attribution refers to that paper, not a claim about every feature of the current Arena website.

Answer Lens uses the general idea of hiding names until after a preference. It does not reproduce Arena's code, assets, branding, datasets, or model answers. The app's code, visual design, icon, and synthetic teaching examples were written for this project. No affiliation or endorsement is implied. This is not an exhaustive prior-art or patent search.

## The specific product choices

**A local paste-first workflow.** The user brings two answers they already have. The app does not generate answers, collect votes, or require access to a particular model. It runs from local files served over loopback; an app-only service worker allows later offline reloads.

**Three judgments, not one invented score.** Usefulness and clarity are rated separately. Factual confidence is explicitly the user's confidence, includes “Not sure,” and is never labelled verified accuracy. No sum or average silently decides which answer wins. The user can prefer A, prefer B, choose a tie, or choose neither.

**A visible commitment point.** Source fields are removed from the rendered comparison page. All ratings and the verdict must exist before reveal, and the revealed UI is read-only. There is no hidden reroll, score editing after reveal, or claim that this commitment is cryptographically enforced.

**A complete, inspectable local record.** The JSON includes full texts, original input order, source names, A/B mapping, seed, algorithm version, timestamps, ratings, verdict, note, synthetic-demo flag, and interpretation caveats. Import checks consistency, not authenticity. Imported results are visibly already revealed and do not imply a new blind trial.

**Small, accessible controls.** Plain English, native keyboard-operable form controls, visible focus, a skip link, clear errors, responsive single-column mobile cards, and an explicit reset make this a practical task tool rather than an evaluation dashboard shell. Recorded checks cover Chrome, keyboard interactions, and 320/390px layouts; they are not a full accessibility certification.

## Where the distinction stops

Interface hiding is not scientific double blinding. Someone who pasted an answer may recognize it; an answer may identify its source; the device owner can inspect local data. No text is silently rewritten to conceal these clues. User-supplied source names are not authenticated.

One person's preference on one question does not show that a model is generally better. The project has no representative question set, recruited evaluator panel, repeated-trial protocol, calibrated truth labels, or aggregate ranking method. The synthetic example is an instructional contrast, not evidence about real models.

Data is local, not encrypted. Device access, extensions, browser storage eviction, and exported-file sharing remain the user's responsibility. The differentiation is the combination and presentation of a bounded personal workflow, not a claim that no other tool offers similar features.
