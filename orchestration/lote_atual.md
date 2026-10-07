# Queima 06/10 — execução autorizada pelo dono em 06/10

Esgotar: sim, até 07/10 04:00 BRT ou ausência de trabalho material. Alvo: INTERNO no branch queima-0610. Nivel: COMPLETO; capturas locais sustentam mudanças de UI, sem alegação de FINAL/publicação. Ordem: entrega, qualidade, dívida com efeito material.

- Q1 | FEITO | Cache offline acompanha bytes do shell. Aceite (efeito): quem já usa offline recebe a correção no próximo reload, sem perder sua comparação. Nivel: COMPLETO. Prova: `npm run test:all` (61 Node, 5 servidor, 44 Chromium); `node --permission --allow-fs-read=. scripts/run-gates.mjs` (61); `docs/design_refs/queima-0610/offline-upgrade-result.png`.
- Q2 | FEITO | Qualidade automática no branch/PR. Nivel: COMPLETO. Prova: `npm run test:all` com Chromium do Playwright (61 + 5 + 44 passes); `.github/workflows/quality.yml`; conferir run hospedado após push.
- Q3 | ABERTO | Reabrir o mesmo JSON após cancelar. Aceite (efeito): cancelar preserva o rascunho e permite tentar de novo imediatamente. Nivel: COMPLETO. Prova: pendente.
- Q4 | ABERTO | Status offline honesto após cache removido/incompleto. Aceite (efeito): a pessoa só confia em reload offline quando os ativos existem; caso contrário sabe manter a aba aberta. Nivel: COMPLETO. Prova: pendente.
