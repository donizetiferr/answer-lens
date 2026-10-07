# Answer Lens — evolução

Curadoria: 2026-10-06 — 0 fechados / 3 novos · solo-backlog AMBOS; inventário gerado em orchestration/backlog_cobertura.md. Os arquivos de backlog/lote não existiam no clone inicial (726f3bf).

Curadoria: 2026-10-06 — 0 fechados / 1 novo · aprofundamento da jornada offline; Q4 confirmado por remoção controlada do cache em contexto efêmero.

Curadoria: 2026-10-06 — 0 fechados / 1 novo · backlog anterior executado; Q5, contratos em dois motores independentes. Sem mudança de escopo de produto.

## Inbox (apontamentos a triar)

Vazio. O despacho do dono autoriza execução no branch queima-0610 até 07/10 04:00 BRT, ou esgotamento material. Sem cliente/terceiro, compra, credencial ou produção. Teste real, commit e push por item.

## Entrega e qualidade

- Q1 · FEITO · Atualizações offline devem renovar o shell quando qualquer ativo muda, preservando dados e caches alheios. `sw.js:3` fixa cache 2.0.0; não há vínculo com bytes do runtime. Aceite: atualização real de duas versões no mesmo Chromium, seguido de reload offline, sem perder comparação salva. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `npm run test:all` (61 Node + 5 servidor + 44 Chromium, zero falhas/skips); `node --permission --allow-fs-read=. scripts/run-gates.mjs` (61). Fonte externa: [MDN — ciclo e cache do worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers): mudança do worker instala nova versão/cache; aplica-se ao shell estático existente.
- Q2 · FEITO · Executar gates, servidor e jornadas Chromium automaticamente em push/PR, com instalação reproduzível. `.github/workflows/public-security.yml:1` só verifica segredos; os testes dependem de execução manual. Aceite: workflow em runner hospedado declarado, ações fixadas, scripts reais passando localmente, sem deploy. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `npm run test:all` usando Chromium padrão (61 Node + 5 servidor + 44 navegador, zero falhas/skips); YAML parseado; ações fixadas nos commits dos tags oficiais v6. Execução hospedada será conferida após o push. Fonte externa: [Playwright CI](https://playwright.dev/docs/ci-intro) e [GitHub Node CI](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs): instalação reproduzível, browser com dependências, jobs hospedados.
- Q2-R · FEITO · Corrigir captura do favicon no Chromium hospedado sem reduzir o aceite: decodificação 48×48 mantida nas duas rotas; captura do mesmo SVG como imagem de página HTML. Origem: falha real do run 37552417010, job 112570761233; 43/44 jornadas passaram, a captura direta de SVG falhou no protocolo. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `node --test --test-name-pattern="favicon assets" tests/prototype.browser.test.mjs` (1/1); próxima execução hospedada confirma.
- Q3 · FEITO · Permitir reabrir o mesmo arquivo JSON depois de cancelar a substituição do rascunho. `src/app.js:204` conserva o valor do file input em import bem-sucedido/cancelado; o browser não emite novo change para a mesma seleção. Aceite: selecionar arquivo, cancelar, selecionar exatamente o mesmo arquivo, confirmar e obter resultado válido com saving off; leitura atrasada não troca uma confirmação de Reset posterior. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `npm run test:all` (61 Node + 5 servidor + 47 Chromium, zero falhas/skips); 3 testes novos falharam antes e passaram depois.

- Q4 · FEITO · Status offline deve verificar os ativos realmente presentes no cache. `src/app.js:399` usa somente `navigator.serviceWorker.ready`; registro ativo sobrevive à remoção do cache. Reprodução Chromium: reload online com zero caches ainda anuncia Offline app ready. Aceite: cache completo confirma pronto; cache ausente/incompleto ou worker sem resposta informa indisponibilidade; comparação continua usável e dados locais preservados. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `npm run test:all` (61 Node + 5 servidor + 50 Chromium); 3 regressões falham antes e passam depois; verificação de 320px sem overflow e worker sem resposta.

- Q5 · FEITO · Validar contratos essenciais em Firefox e WebKit Linux. A suíte browser original importa somente Chromium (`tests/browser.test.mjs:7`, `tests/evolution.browser.test.mjs:8`); docs/prototype-verification.json declara limitação Chrome-only. Aceite: leitura cega e trava, clipboard negado, export/import real, continuação da pergunta, 320px e consentimento/save/offline conforme capacidades em ambos os motores; zero exceções, dados enviados ou skips. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: 4/4 jornadas em cada motor (Chromium 153, Firefox 155, WebKit 26.6), 61 gates Node; zero skips/exceções/dados enviados. Fonte externa: [Playwright Browsers](https://playwright.dev/docs/browsers): Firefox/WebKit e binários específicos da versão; permite verificar o runtime sem Windows/dispositivo físico.

## Pendências externas

- Windows, dispositivos físicos e navegador autenticado: fora desta sessão; registrar necessidades concretas quando encontradas.
- Promoção para main/publicação: fora da autorização; somente push do branch queima-0610.
