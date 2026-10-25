# Revisão local de correção — ciclo 2, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `47f4a13`.
Histórico anterior lido: `docs/revisao-headless-2026-10-25.md`.
Conferência final: 25/10/2026, 02:02 BRT, Linux, Node `v24.16.0`.

## Pendências e limites

Nenhum item local selecionado ficou pendente. Não havia backlog, specs, lotes,
TODO/FIXME, `CLAUDE.md` ou `AGENTS.md` no clone. Este ciclo continuou a auditoria
de correção e cobertura, sem repetir as cinco correções anteriores.

Integração, publicação e browser permanecem com a sessão dona. Não houve uso de
navegador, Windows, credencial, dado de produção, cliente ou serviço pago. O único
envio foi o push explicitamente autorizado deste branch. Main/master, CI,
instruções e controles de outras sessões não foram alterados.

## Entregas

| Commit | Resultado e caso reproduzido |
| --- | --- |
| `60837f1` | Recusa arrays JavaScript com posições ausentes no par de respostas e no sorteio. Antes, `delete session.inputs[0]` passava pela validação, permitindo criar resultado inválido e exportação sem roundtrip. A verificação do sorteio também ignorava posições ausentes. Esse caso afeta chamadas diretas do núcleo; JSON com `null` já era recusado. |
| `c36eecd` | Libera a seleção do input de arquivo depois de capturar a referência `File`. Cancelar a confirmação de importação e selecionar o mesmo JSON pode abrir novamente a confirmação, mantendo o rascunho e o salvamento desligado. Antes, a seleção ficava retida e o novo `change` não acontecia. |
| `346f0e1` | Compara também os dígitos fracionários que `Date.parse` descarta. Um bloqueio em `.123455Z` não pode preceder uma atribuição em `.123456Z`. Preserva igualdade com zeros finais, offsets equivalentes e os formatos ISO já aceitos. Aplica a regra ao bloqueio e à validação/importação. |
| `5d1e5e5` | Ao desligar e religar o salvamento durante uma exclusão pendente, mantém o estado `saving` até a nova gravação terminar. Antes, a exclusão concluída mudava o aviso para “Saving is off” apesar da opção marcada e de uma gravação ainda esperando o lock. |
| `63467cb` | Acrescenta cobertura local de filas, cancelamento por reset, conflito com outra aba, falha/retry e aviso antes de sair. Amplia os testes HTTP do preview: arquivos completos, bytes e headers, HEAD, bloqueio de uploads e proteção dos arquivos do repositório. Documenta os limites das simulações no README. |

As quatro correções tiveram teste observado falhando antes do ajuste e passando
depois. A cobertura complementar verifica contratos existentes; não representa
outros bugs descobertos. Cada item recebeu commit próprio e push.

Os módulos gerados do preview, hashes e metadados foram sincronizados quando o
runtime mudou. IDs de coleção/jornadas, CSS, HTML, isolamento, formato do produto
e versão permaneceram estáveis. Nenhum release foi criado.

## Evidência reproduzível

```sh
node scripts/run-gates.mjs
# 78 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico. Export/import/export exato aprovado também
# em execução separada e nos gates.

git diff --check 47f4a13..HEAD
# Sem erros de whitespace.
```

Base deste ciclo: 68 testes isolados e 5 de servidor, todos verdes. Acréscimo:
10 testes isolados e 2 de servidor. Também foram executadas separadamente as
suítes de núcleo e evolução a cada correção correspondente.

Os testes de handlers executam o `src/app.js` real em VM Node, retirando apenas
os imports e injetando os módulos reais, um DOM mínimo e Web Locks controlados.
Não duplicam a implementação de importação ou persistência. Os cenários exercem:

- Cancelar e repetir a seleção do mesmo JSON; repetir arquivos inválidos ou
  grandes demais; descartar leitura que termina depois da troca de tela.
- Excluir e reativar o salvamento com a fila bloqueada, conferindo o estado antes
  e depois de cada liberação do lock.
- Coalescer edições obsoletas; resetar durante uma gravação pendente e preservar
  o novo rascunho; cancelar a escrita ao receber atualização de outra aba.
- Preservar o registro externo no reset; reportar falha de lock; salvar no retry
  e só então deixar de solicitar o aviso de saída.

O DOM mínimo modela apenas os recursos necessários a esses testes. Não certifica
seletor nativo de arquivos, diálogos, APIs reais do navegador, layout ou
acessibilidade. Os testes de service worker do ciclo anterior continuaram verdes.

## Conferência da sessão dona antes de integrar

1. Revisar `47f4a13..HEAD` para este ciclo e `726f3bf..HEAD` para o conjunto dos
   dois ciclos. Conferir especialmente as mudanças anteriores de cache offline.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome já disponíveis.
   Este worker respeitou a proibição de navegador.
3. Com rascunho preenchido, selecionar um JSON válido, cancelar a confirmação e
   selecionar exatamente o mesmo arquivo. A confirmação deve reaparecer sem
   perder o rascunho; confirmar deve abrir o resultado sem consentir em salvar.
4. Com o lock ocupado por outra aba, desligar e religar o salvamento. Após a
   exclusão, o aviso deve continuar pendente até a nova gravação efetiva. Conferir
   no app e no preview, preservando dados e caches separados.
5. Manter também as verificações reais de atualização online/offline e migração
   descritas no relatório do ciclo anterior. Não houve nova evidência de browser.

Conferido: revisão do autor sobre pedido, diffs, contratos e casos reproduzidos;
quatro regressões observadas vermelhas antes das correções; 78 testes isolados e
7 de servidor verdes; demo com roundtrip exato; 13 artefatos do preview sem drift.
Não surgiu outro achado material reproduzível na varredura local final.
