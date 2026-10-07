# Queima Codex 06/10 — relatório interno

## O que ficou

- **Sem item material aberto executável nesta sessão**, após curadoria solo-backlog e revisão transversal de 17/17 grupos. A ordem priorizou durabilidade da entrega e perda de trabalho; depois qualidade contínua e cobertura real dos motores. Não foi introduzida monetização sem requisito/cliente.
- **Windows, celular físico, Safari instalado e viewer autenticado:** mudanças atuais não verificadas nesses ambientes. Linux/viewport e sandbox equivalente não substituem essa verificação. Pendência externa do dono quando esses ambientes estiverem disponíveis.
- **Main/publicação/produção/cliente:** fora da autoridade do despacho. Somente `origin/queima-0610` recebeu pushes; nenhum envio, compra, credencial nova ou mudança de serviço foi feito.
- **Ferramentas globais da skill:** enumerador/coverage-check/slop-check ausentes no VPS. Inventário foi gerado de Git e revisado na sessão principal; não se declara que os comandos ausentes passaram. Não bloqueia os testes efetivos do projeto.

## Fechados com teste, commit e push

Baseline do clone: `726f3bfc549158fbd357c77a1b16a9434a085500`. Não existiam `evolution_plan.md`, `orchestration/lote_atual.md` ou `lotes/` nesse baseline; prospecção foi necessária desde o início. Todos os IDs abaixo nasceram de evidência interna e foram executados no escopo do despacho. Nivel de entrega: **COMPLETO**, alvo **INTERNO**, sem alegação de FINAL visual ou release independente.

| Item | Efeito entregue | Commit enviado | Teste real concluído |
|---|---|---|---|
| Q1 | Shell offline recebe novos bytes sem perder comparação; instalação interrompida conserva versão utilizável | `284cd7a` | `npm run test:all`: 61 Node + 5 servidor + 44 Chromium; atualização de duas versões e reload offline; gate restrito 61 |
| Q2 | Gates Node 22/24, servidor e jornadas Chromium em cada push/PR, ações fixadas e sem deploy | `5cb1eeb` | 61 + 5 + 44 localmente; jobs hospedados confirmados após Q2-R/Q3 |
| Q2-R | Favicon decodificado 48×48 nas duas rotas e capturado em HTML no runner | `c5c36f3` | 1/1 direcionado; Chromium hospedado verde no run 37552732805 |
| Q3 | Cancelar import permite escolher o mesmo JSON; leitura atrasada não troca decisão posterior | `32489bb` | 3 regressões falharam antes/passaram depois; suíte 61 + 5 + 47; capturas 1440/390px inspecionadas |
| Q4 | Rodapé consulta ativos do cache antes de anunciar disponibilidade offline | `6b83258` | 3 regressões antes/depois; suíte 61 + 5 + 50; gate restrito 61; capturas 1440/320px inspecionadas |
| Q5 | Jornadas essenciais em Firefox e WebKit Linux, incluindo download/reimport e cache sem origem disponível | `44b7d8d` | 4/4 em cada motor Chromium 153, Firefox 155, WebKit 26.6; zero skips/exceções/envios; 4 capturas inspecionadas |
| Q6 | Teste de Reset espera exclusão real sob Web Lock e comprova status pendente sem perder edição nova | `947ec7e` | 3/3 direcionados e 51/51 Chromium completos, zero skips; lock real retido/liberado |

Cada commit acima foi seguido de `git push origin queima-0610` bem-sucedido. Os registros completos do lote estão em [delivered_items.md](delivered_items.md); detalhes, causas e capturas em [evidências](../docs/queima-0610-evidencias.md).

## CI e provas finais

CI de `947ec7e`: **5/5 jobs verdes** (Node 22, Node 24, Chromium 51/51, Firefox 4/4 e WebKit 4/4) no [run 37554313868](https://github.com/donizetiferr/answer-lens/actions/runs/37554313868); Secret scan [37554313883](https://github.com/donizetiferr/answer-lens/actions/runs/37554313883). Secret scan completo: success.

Resultados anteriores recuperáveis: [37552732805](https://github.com/donizetiferr/answer-lens/actions/runs/37552732805) verde (Q2/Q2-R/Q3); [37553277831](https://github.com/donizetiferr/answer-lens/actions/runs/37553277831) verde (Q4). O primeiro run de Q2 falhou na captura SVG; Q5 revelou uma espera prematura no teste antigo de Reset (49/50 Chromium). Ambos foram corrigidos com commit/teste; não foram apresentados como runs verdes. O run intermediário de Q2-R foi cancelado pelo push seguinte.

Local: gate de filesystem restrito 61/61, servidor 5/5 na suíte de Q4, Chromium 51/51 após Q6 e portabilidade 4/4 por motor. `node scripts/sync-prototype.mjs --check`: 13 arquivos coerentes e shell atual. JSONs de docs válidos; 30 links locais novos/afetados resolvem. Autores/committers dos sete commits de trabalho usam noreply. SHA-256 dos vídeos v2/final confere com seus recibos; toda mídia/reviews históricos preservados. Novas imagens usam dados sintéticos e foram vistas antes de inclusão. Logs brutos, downloads e bibliotecas locais ficaram em diretórios ignorados.

A execução local WebKit preservou o caminho de bibliotecas no wrapper ignorado; a heurística de host do SDK foi desativada somente após carga real da biblioteca faltante, e o browser efetivo passou nas asserções. No CI usa-se instalação oficial com dependências, sem esse ajuste. O teste offline desliga o servidor e exige falha de uma aba nova sem worker antes do reload positivo, evitando [defeito de emulação WebKit do Playwright 1.63](https://github.com/microsoft/playwright/issues/42775), sem skip ou mock do cache.

## Curadoria e critério de parada

Cobertura: **17/17 grupos** — 6 com achado, 11 SEM ACHADO, 0 NAO analisado. A lista de arquivos é gerada de `git ls-files --cached --others --exclude-standard -z`, não de uma seleção manual. Fallback: `python3 evidence/generate-inventory.py`, com recibo local em `evidence/final-inventory.json`. Disposições e o que foi examinado estão em [backlog_cobertura.md](backlog_cobertura.md).

Backlog nesta passada: 6011 → 6275 bytes (acréscimo somente da linha de curadoria); 0 itens em andamento tocados pela curadoria. Última passada: 0 fechados por reconciliação, 0 novos, 0 repriorizados, 0 fechados sem evidência, Inbox 0 → 0, 0 itens removidos/revogados. Não se forçou item para gastar cota. O plano cresceu nesta sessão para registrar achados e provas reais porque não havia backlog no clone; o fechamento só acrescenta a linha de curadoria. O lote foi arquivado integralmente e o lote atual limpo.

**Encerrado em 2026-10-06 21:55 BRT**, antes do limite de 07/10 04:00 BRT, por esgotamento material dentro dos limites autorizados. Main e origin/main permanecem no baseline. Este resultado é uma revisão delimitada, não prova de ausência universal de defeitos.
