# Answer Lens design

A quiet local comparison tool: readable answer cards, visible progress through prepare/compare/reveal, and a clear distinction between personal preference and verified accuracy. System fonts, cream background and dark green controls. The responsive prototype in `design_refs/answer-lens` runs the same application files as the root app. Comparison, export/import, reset and optional storage are functional.

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
