# Evidências da execução interna de 06/10

Todas as verificações usam dados sintéticos, servidores loopback efêmeros e contextos novos. Nada foi publicado em main/produção.

## Q1 — atualização offline

`npm run test:all`: 61 gates Node, 5 servidor e 44 testes Chromium, todos passando, sem skips. `node --permission --allow-fs-read=. scripts/run-gates.mjs`: 61 gates passando. `node scripts/sync-prototype.mjs --check`: 13 arquivos coerentes e revisão offline atual.

O teste `tests/offline.browser.test.mjs` serve duas gerações do shell no mesmo origin. Mantém rascunho salvo, seleção/foco e cache alheio durante a ativação, verifica remoção do cache antigo, depois revela e reabre offline com os novos bytes e o mesmo resultado. A segunda jornada interrompe o download de um ativo e prova que a versão anterior e o rascunho salvo continuam utilizáveis offline. A revisão também cobre mudanças no próprio worker e todas as adaptações do protótipo.

TELA: contexto local de `tests/offline.browser.test.mjs` | VI: resultado salvo restaurado offline, pergunta sintética preservada, fontes reveladas, avaliações omitidas como Not rated, ações de cópia/exportação e saving visíveis. PNG inspecionado: [resultado após atualização](design_refs/queima-0610/offline-upgrade-result.png). O rodapé “Offline upgrade after” é um marcador da fixture de duas versões, não texto enviado ao runtime real. Nivel: COMPLETO, alvo INTERNO; não se declara FINAL visual.

A verificação aguarda o estado `activated` do controlador antes de julgar a limpeza de caches. Um `controllerchange` sozinho ainda permite que o evento de ativação esteja em andamento. As execuções locais usam `CHROME_PATH` explícito e bibliotecas extraídas em diretório ignorado; nenhum pacote do sistema/serviço foi alterado. Logs brutos em `evidence/`, fora do Git.
