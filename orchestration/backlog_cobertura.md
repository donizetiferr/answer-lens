# Cobertura do backlog — queima 06/10

Cobertura: 17/17 grupos (6 com achado · 11 SEM ACHADO · 0 NAO analisado), 112 arquivos enumerados. Tipologia: aplicação web estática local-first; módulos, preview gerado, servidores/testes, documentação/mídia e CI.

Denominador GERADO em 06/10 a partir de `git ls-files --cached --others --exclude-standard -z`, por fronteiras não sobrepostas. O enumerador/coverage-check global da skill não está instalado neste host; fallback executado por `python3 evidence/generate-inventory.py` (local ignorado), sem fingir execução do comando ausente. Lista de arquivos gerada, disposições registradas após revisão na sessão principal. O inventário inclui seus próprios registros de fechamento.

Provas e limites: docs/queima-0610-evidencias.md e orchestration/queima-0610-relatorio.md. Fase transversal: a revisão cruzou cache/gerador/worker/runtime e import/modal/persistência; achados Q1–Q6 executados, sem novo achado material aberto.

## contratos e documentação

Estado: SEM ACHADO: contratos de local-first, limites, licença e privacidade confrontados com runtime; Playwright fixado no lock, sem dependências de produção; metadados históricos de entrega não promovidos.

Arquivos: `.gitattributes`, `.gitignore`, `.nojekyll`, `LICENSE`, `README.md`, `SECURITY.md`, `buildsignal-gates.json`, `package-lock.json`, `package.json`

## demonstração e gates

Estado: SEM ACHADO: demo determinístico/export-import validado; runner single-process com permissão de filesystem restrita; captura usa binário Playwright ou override explícito. Nenhuma chamada de modelo/credencial.

Arquivos: `scripts/capture-demo.mjs`, `scripts/demo.mjs`, `scripts/run-gates.mjs`

## design e evidências

Estado: SEM ACHADO: direção visual/contratos existentes, capturas novas inspecionadas; JSONs parseados e reviews antigos mantidos como históricos. Nenhuma alegação de certificação física/FINAL acrescentada.

Arquivos: `docs/DESIGN.md`, `docs/design_refs/answer-lens-evolution/DESIGN.md`, `docs/design_refs/answer-lens-evolution/baseline.json`, `docs/design_refs/answer-lens-evolution/captures.json`, `docs/design_refs/answer-lens-evolution/captures/baseline-1440.png`, `docs/design_refs/answer-lens-evolution/captures/baseline-390.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-copy-fallback.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-desktop-prepare.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-desktop-reading.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-desktop-result.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-320-decision.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-320-enlarged.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-320-long.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-390-decision.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-390-long.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-mobile-result.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-repeat-question.png`, `docs/design_refs/answer-lens-evolution/captures/evolution-save-failure.png`, `docs/design_refs/answer-lens-evolution/visual-review.json`, `docs/design_refs/queima-0610/firefox-result-1440.png`, `docs/design_refs/queima-0610/firefox-result-320.png`, `docs/design_refs/queima-0610/import-retry-desktop.png`, `docs/design_refs/queima-0610/import-retry-mobile.png`, `docs/design_refs/queima-0610/offline-unavailable-desktop.png`, `docs/design_refs/queima-0610/offline-unavailable-mobile.png`, `docs/design_refs/queima-0610/offline-upgrade-result.png`, `docs/design_refs/queima-0610/webkit-result-1440.png`, `docs/design_refs/queima-0610/webkit-result-320.png`, `docs/design_refs/superficies.json`, `docs/differentiation.md`, `docs/evidence.md`, `docs/evolution-evidence.md`, `docs/prototype-evidence.md`, `docs/prototype-verification.json`, `docs/queima-0610-evidencias.md`, `docs/v2-release-review.md`, `docs/verification.json`

## distribuição e mídia

Estado: SEM ACHADO: proveniência/licenças/exemplos sintéticos, SHA-256 de ambos vídeos com recibo confirmado, mídia e reviews históricos idênticos ao baseline; nenhuma regeneração ou publicação necessária.

Arquivos: `media/answer-lens-final-preview.json`, `media/answer-lens-final-preview.mp4`, `media/answer-lens-preview.mp4`, `media/answer-lens-v2-preview.json`, `media/answer-lens-v2-preview.mp4`, `media/review-v2/desktop-blind.png`, `media/review-v2/desktop-result.png`, `media/review-v2/mobile-ratings.png`, `media/review-v2/mobile-result.png`

## geração do protótipo e shell

Estado: com achado: Q1; revisão SHA-256 vinculada a bytes e caminhos, normalização do próprio marker e preview adaptado; drift rejeitado no gate e check read-only.

Arquivos: `scripts/sync-offline.mjs`, `scripts/sync-prototype.mjs`

## integração contínua

Estado: com achado: Q2/Q2-R/Q5/Q6; testes ausentes no CI, captura SVG incompatível e cobertura de motor único corrigidos. Jobs read-only e SHA fixados; scan de segredos preservado.

Arquivos: `.github/workflows/public-security.yml`, `.github/workflows/quality.yml`

## interface

Estado: SEM ACHADO: HTML/CSS/foco e controles nativos; jornadas de teclado, longa leitura/zoom Chromium preexistentes e 320px em três motores; sem corte nas novas capturas. Não equivale a auditoria com leitor de tela.

Arquivos: `icon.svg`, `index.html`, `styles.css`

## offline

Estado: com achado: Q1/Q4; atualização real de duas versões, instalação interrompida, não recriar cache antigo, caches alheios preservados e consulta somente a ativos do próprio shell.

Arquivos: `sw.js`

## orquestração e backlog

Estado: SEM ACHADO: ausência de backlog inicial confirmada no baseline; IDs/provas/commits reconciliados, Inbox vazio, pendências externas e autorização do dono explícitas; fechamento sem apagar histórico.

Arquivos: `evolution_plan.md`, `orchestration/backlog_cobertura.md`, `orchestration/delivered_items.md`, `orchestration/lote_atual.md`, `orchestration/processos_executados.md`, `orchestration/queima-0610-relatorio.md`

## protótipo isolado

Estado: com achado: Q1/Q3/Q4 refletidos pelo gerador; sync --check de 13 arquivos, hashes e isolamento de keys/locks/cache; jornadas/sandbox Chromium reais no CI.

Arquivos: `docs/design_refs/answer-lens/captures/round3-copy-fallback.png`, `docs/design_refs/answer-lens/captures/round3-desktop-reading.png`, `docs/design_refs/answer-lens/captures/round3-desktop-result.png`, `docs/design_refs/answer-lens/captures/round3-mobile-reading.png`, `docs/design_refs/answer-lens/captures/round3-mobile-result.png`, `docs/design_refs/answer-lens/comparison.html`, `docs/design_refs/answer-lens/icon.svg`, `docs/design_refs/answer-lens/index.html`, `docs/design_refs/answer-lens/mobile.html`, `docs/design_refs/answer-lens/prancheta.json`, `docs/design_refs/answer-lens/resources.json`, `docs/design_refs/answer-lens/src/app.js`, `docs/design_refs/answer-lens/src/core.js`, `docs/design_refs/answer-lens/src/demo.js`, `docs/design_refs/answer-lens/src/output.js`, `docs/design_refs/answer-lens/src/storage.js`, `docs/design_refs/answer-lens/styles.css`, `docs/design_refs/answer-lens/sw.js`

## servidores locais

Estado: SEM ACHADO: allowlists, loopback, MIME/CSP/no-sniff, rejeição de uploads/traversal; cinco checks reais de servidor e teste negativo de origem desligada.

Arquivos: `scripts/serve-prototype.mjs`, `scripts/serve.mjs`

## src/app.js

Estado: com achado: Q3/Q4; repetição de import cancelado, decisão posterior durante File.text e prontidão real de cache. Revisão também abrange save queue, tickets, modal, copy/download e texto inerte.

Arquivos: `src/app.js`

## src/core.js

Estado: SEM ACHADO: schemas/validação canônica, limites, v1 preservado, ratings omitidos, trava, seed/order e question-only nextPair; gates e export/import reais em três motores.

Arquivos: `src/core.js`

## src/demo.js

Estado: SEM ACHADO: exemplos originais declarados sintéticos, nenhuma saída real de modelo/dados de cliente, consentimento explícito mantido ao carregar demo.

Arquivos: `src/demo.js`

## src/output.js

Estado: SEM ACHADO: saídas puras de texto, preferência A/B correta, tie/neither sem vencedor inventado, ratings omitidos e caveats; clipboard negado verificado nos três motores.

Arquivos: `src/output.js`

## src/storage.js

Estado: SEM ACHADO: consentimento off inicial, Web Lock + snapshot, leitura sem exclusão, proteção de registros futuros/malformados e v1 separado; testes Node/conflito real entre abas Chromium.

Arquivos: `src/storage.js`

## testes

Estado: com achado: Q2-R/Q3/Q4/Q5/Q6; espera de leitura assíncrona corrigida, regressões reproduzidas antes/depois e jornadas Firefox/WebKit Linux; nenhum skip de teste para contornar falha offline.

Arquivos: `tests/browser.test.mjs`, `tests/core.test.mjs`, `tests/demo.test.mjs`, `tests/evolution.browser.test.mjs`, `tests/evolution.test.mjs`, `tests/fixtures/sessions.mjs`, `tests/fixtures/v1/core.js`, `tests/fixtures/v1/storage.js`, `tests/offline.browser.test.mjs`, `tests/offline.test.mjs`, `tests/portability.browser.test.mjs`, `tests/prototype.browser.test.mjs`, `tests/prototype.test.mjs`, `tests/server.test.mjs`, `tests/storage.test.mjs`
