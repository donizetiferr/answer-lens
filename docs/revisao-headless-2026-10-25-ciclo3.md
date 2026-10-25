# Revisão local de correção — ciclo 3, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `3b897ac`.
Os relatórios dos ciclos 1 e 2 e o histórico do branch foram lidos antes da execução.
Conferência final: 25/10/2026, 02:14 BRT, Linux, Node `v24.16.0`.

## Pendências e limites

Nenhum item local selecionado ficou pendente. Não há backlog, specs, lotes,
TODO/FIXME, `CLAUDE.md` ou `AGENTS.md` neste clone. O ciclo continuou a auditoria
de correção e cobertura do código crítico, sem repetir os itens anteriores.

A integração, o check obrigatório de CI e a validação real no navegador ficam
com a sessão dona. Não houve navegador, Windows, credencial, produção, cliente,
gasto, deploy, merge ou alteração em main/master. As instruções, a configuração
de CI e os controles de outras sessões foram preservados.

Além dos pushes autorizados do branch, foi baixado o scanner público, gratuito
e com checksum fixado pelo próprio projeto, para cumprir `SECURITY.md`.
Os commits novos usam e-mail `noreply`; nenhum histórico anterior foi reescrito.

## Entregas

| Commit | Resultado e prova do defeito ou da cobertura |
| --- | --- |
| `82ceaec` | Corrige o fixture do app: as funções importadas conservavam o `localStorage` padrão do módulo Node, fora da VM. Dois testes novos falharam antes do ajuste: um rascunho salvo aparecia vazio e um registro futuro aparecia como falha de acesso, em vez de protegido. As leituras agora recebem explicitamente o armazenamento simulado, incluindo restauração, abertura v1 e releitura após eventos de outra aba. |
| `bfc5cdd` | Reset e importação sem cópia salva deixam de acusar falha de exclusão em ambiente sem Web Locks. A regressão falhou antes: o estado era `delete-failed` apesar da ausência de registro. A ausência é conferida por leitura, sem mutação; cópias existentes continuam exigindo o lock e permanecem preservadas quando ele está indisponível. |
| `9cba012` | O retorno de uma cópia antiga deixa de alterar o aviso ou o texto alternativo da ação mais recente. Uma cópia bem-sucedida também limpa o texto alternativo anterior. Dois testes falharam antes: uma rejeição tardia reabria a nota depois da cópia da resposta, e uma cópia bem-sucedida mantinha a nota antiga visível. Outros dois testes cobrem sucesso tardio depois de falha mais recente e conclusão depois de Reset. |
| `97f5287` | Cobre confirmações antigas de substituição, recuperação depois de registros futuros, instalação do shell antes da tomada de controle, falha no precache e exclusão restrita aos caches antigos do próprio escopo. São quatro testes adicionais de contratos existentes, sem outro defeito de runtime descoberto. Documenta os limites dos fixtures no README. |

Cada item recebeu commit próprio e push. Mudanças no `src/app.js` foram
sincronizadas no preview existente, junto com hashes e metadados. IDs, jornadas,
HTML, CSS, versão do produto e isolamento de armazenamento/cache foram mantidos.
Não houve nova peça visual, captura ou release.

## Evidência reproduzível

```sh
node scripts/run-gates.mjs
# 90 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico; roundtrip exato também aprovado nos gates.

git diff --check 3b897ac..HEAD
# Sem erros de whitespace.
```

Base: 78 testes isolados e 7 de servidor. Este ciclo acrescentou 12 testes
isolados. As suítes dos ciclos anteriores permaneceram verdes.

Uma sondagem adicional de capacidade máxima preencheu pergunta, ambas as
respostas, fontes e nota até os respectivos limites, com NUL, CJK e emoji.
Exportação/importação preservou os dados, com 542.555, 271.835 e 181.595 bytes,
respectivamente, abaixo dos 600.000 bytes permitidos. Não houve ajuste decorrente.

Gitleaks `8.30.1`, com a configuração confiável do workflow, ignorando supressões
locais e com saída totalmente redigida, conferiu o histórico completo disponível
(`--all --full-history`, clone não raso) e a árvore de trabalho. Ambos terminaram
com código zero, sem achados, erros ou avisos. O arquivo baixado corresponde ao
SHA-256 fixado pelo workflow. Nenhum relatório do scanner foi versionado.

## Revisão do autor e limites da evidência

O double check confrontou pedido, histórico anterior, alterações, jornada de
salvamento/importação, notificações entre abas, operações pendentes, retorno
da cópia, contratos de importação/exportação e ciclo de cache do app e preview.
Não surgiu outro achado material reproduzível na varredura local final.

Os testes executam os handlers reais do app e os scripts reais dos workers.
O DOM e as APIs são substitutos controlados: não certificam layout, seletor
nativo de arquivos, permissões reais, atomicidade de `Cache.addAll`, controle
de páginas ou a ordem das escritas nativas na área de transferência do sistema.
O ajuste de cópia controla os avisos e o texto alternativo da aplicação;
não cancela escritas que o navegador já tenha recebido.

## Conferência da sessão dona antes de integrar

1. Revisar `3b897ac..HEAD` para este ciclo e `726f3bf..HEAD` para os três ciclos.
   O alvo do worker é somente este branch, sem promoção automática.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome. Conferir o
   check obrigatório **Secret scan** antes de integrar. Este worker não rodou
   as suítes de browser por proibição explícita do despacho.
3. No app e no preview, conferir Reset e abertura de JSON sem Web Locks e sem
   cópia salva: devem permanecer em modo de aba. Com uma cópia existente, a
   exclusão sem lock deve avisar da falha e preservar os dados.
4. Conferir a cópia negada seguida de uma cópia bem-sucedida: o texto alternativo
   antigo deve desaparecer. Exercitar também negativas e conclusões tardias,
   verificando aviso, seleção e conteúdo efetivo da área de transferência.
5. Manter as verificações reais dos ciclos anteriores: atualização online/offline
   com worker antigo instalado, migração v1, repetição do mesmo arquivo após
   cancelar importação e alternância do salvamento com lock ocupado.

Conferido: regressões observadas antes dos ajustes; 90 testes isolados e 7 de
servidor verdes; demo com roundtrip exato; 13 artefatos sincronizados; revisão
dos diffs e dos efeitos entre abas; scanner de histórico e árvore sem achados.
