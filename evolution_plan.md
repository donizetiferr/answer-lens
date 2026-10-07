# Answer Lens — evolução

Curadoria: 2026-10-06 — 0 fechados / 3 novos · solo-backlog AMBOS; inventário gerado em orchestration/backlog_cobertura.md. Os arquivos de backlog/lote não existiam no clone inicial (726f3bf).

## Inbox (apontamentos a triar)

Vazio. O despacho do dono autoriza execução no branch queima-0610 até 07/10 04:00 BRT, ou esgotamento material. Sem cliente/terceiro, compra, credencial ou produção. Teste real, commit e push por item.

## Entrega e qualidade

- Q1 · FEITO · Atualizações offline devem renovar o shell quando qualquer ativo muda, preservando dados e caches alheios. `sw.js:3` fixa cache 2.0.0; não há vínculo com bytes do runtime. Aceite: atualização real de duas versões no mesmo Chromium, seguido de reload offline, sem perder comparação salva. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO. Prova: `npm run test:all` (61 Node + 5 servidor + 44 Chromium, zero falhas/skips); `node --permission --allow-fs-read=. scripts/run-gates.mjs` (61). Fonte externa: [MDN — ciclo e cache do worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers): mudança do worker instala nova versão/cache; aplica-se ao shell estático existente.
- Q2 · ABERTO · Executar gates, servidor e jornadas Chromium automaticamente em push/PR, com instalação reproduzível. `.github/workflows/public-security.yml:1` só verifica segredos; os testes dependem de execução manual. Aceite: workflow em runner hospedado declarado, ações fixadas, scripts reais passando localmente, sem deploy. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO.
- Q3 · ABERTO · Permitir reabrir o mesmo arquivo JSON depois de cancelar a substituição do rascunho. `src/app.js:204` conserva o valor do file input em import bem-sucedido/cancelado; o browser não emite novo change para a mesma seleção. Aceite: selecionar arquivo, cancelar, selecionar exatamente o mesmo arquivo, confirmar e obter resultado válido com saving off. Nivel: COMPLETO · Alvo: INTERNO. objetivo_origem: PROSPECCAO.

## Pendências externas

- Windows, dispositivos físicos e navegador autenticado: fora desta sessão; registrar necessidades concretas quando encontradas.
- Promoção para main/publicação: fora da autorização; somente push do branch queima-0610.
