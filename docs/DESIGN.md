# Answer Lens design

**Evolution 2.0 review:** the current screen plan and acceptance journeys are in [design_refs/answer-lens-evolution/DESIGN.md](design_refs/answer-lens-evolution/DESIGN.md), with actual baseline and new captures bound by hashes. The older `design_refs/answer-lens` prototype below is a preserved v1 reference, not the current runtime.

A quiet local comparison tool: readable answer cards, visible progress through prepare/compare/reveal, and a clear distinction between personal preference and verified accuracy. System fonts, cream background and dark green controls. The responsive prototype in `design_refs/answer-lens` preserves the v1 application files; it is no longer identical to the evolved root app. Comparison, export/import, reset and optional storage are functional.

```yaml
perfil: answer-lens-claro
cores:
  fundo: "#f6f5ef"
  tinta: "#203332"
  acento: "#2d604b"
fontes: [system-ui]
raios: [10]
```

Independent review on 2026-09-21 exercised desktop 1440x1000 and mobile 390x844 without horizontal overflow, choice before reveal, actual JSON download/import, and reset. The predecessor comparison method and this tool's narrower scope are described in `differentiation.md`. The six-second native Studio preview uses real UI captures with labelled synthetic examples; it is a screenshot sequence, not a continuous screen recording or a model benchmark.
