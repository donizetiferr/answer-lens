# Revisão local de correção — ciclo 5, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `9b9f856`.
Histórico e quatro relatórios anteriores lidos antes do trabalho.
Código e testes conferidos em `4990d01`, Linux, Node `v24.16.0`, às 02:34 BRT.

## Pendências e limites

Nenhum item local selecionado ficou pendente. O clone continua sem backlog,
specs, lotes, TODO/FIXME ou instruções locais CLAUDE/AGENTS. A auditoria continuou
pelos caminhos críticos de confirmação, importação, cópia, exportação no visor
restrito, notas opcionais e falhas de armazenamento. Não surgiu outro achado
material reproduzível na conferência final dessas superfícies.

A validação real no navegador, o check obrigatório **Secret scan** e a integração
ficam com a sessão dona. Este despacho proibiu navegador: não há nova captura,
validação visual, evidência de sandbox nativo ou teste de APIs reais do browser.
Os substitutos de DOM, armazenamento, locks e clipboard exercitam controle de
fluxo dos handlers reais, sem certificar permissões, seleção, diálogos ou foco
nativos. Não houve Windows, produção, credencial, cliente, gasto ou deploy.

Os únicos envios foram os pushes autorizados deste branch. Main/master, CI,
instruções e arquivos de controle de outras sessões permaneceram intactos.

## Entregas

| Commit | Resultado e evidência |
| --- | --- |
| `b20c9c6` | Uma leitura lenta de JSON podia trocar o título e a ação de uma confirmação de Reset já aberta. Uma rejeição tardia também podia abrir um erro durante a confirmação ou depois de cancelá-la. Dois testes novos falharam antes do ajuste. Toda nova confirmação agora invalida a leitura anterior; confirmar continua executando Reset, cancelar preserva o rascunho, e o erro obsoleto é descartado. |
| `4ea9664` | No visor de origem opaca do preview, exportar seleciona o JSON completo em vez de baixar arquivo. Uma cópia anterior ainda pendente podia esconder esse texto ao concluir ou substituí-lo pela nota ao falhar. A regressão falhou antes do ajuste. A exportação agora invalida o retorno antigo da cópia. O teste confere sucesso e rejeição tardios, preservando JSON, rótulo, seleção e aviso. O fixture passou a executar também o app gerado e seu módulo real de armazenamento, com as chaves do preview. |
| `4990d01` | Acrescenta quatro testes de contratos existentes: limpar ratings preservando veredito e motivo; falha de quota ao comparar e revelar, com recuperação no retry; exclusão recusada preservando os bytes e o aviso; handlers do preview preservando chaves do app e ignorando eventos de armazenamento do app principal. Os três primeiros rodam no app e no preview, totalizando sete cenários. Não exigiram outra correção de runtime. O README explica a nova cobertura e seus limites. |

Cada item recebeu commit próprio e push. A confirmação corrigida foi
sincronizada na coleção existente; o ajuste exclusivo do visor foi feito no
gerador e reproduzido no app gerado. Os hashes e metadados correspondentes
continuam reproduzíveis. IDs, jornadas, HTML, CSS, versão, formato de dados,
isolamento de chaves, locks e caches foram preservados. Não houve release.

## Evidência reproduzível

```sh
node scripts/run-gates.mjs
# 101 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico; export/import/export exato conferido também
# em execução separada e nos gates.

git diff --check 9b9f856..HEAD
# Sem erros de whitespace.
```

Base: 94 testes isolados e 7 de servidor. Acréscimo: sete testes isolados.
As suítes anteriores permaneceram verdes. Os testes direcionados foram
executados antes e depois das correções, seguidos pelos gates completos.

Gitleaks `8.30.1` foi reutilizado, sem novo download. O arquivo corresponde ao
SHA-256 fixado pelo workflow. Configuração confiável, supressões locais
desconsideradas e saída totalmente redigida: árvore de trabalho e histórico
completo disponível (`--all --full-history`) terminaram sem achados, erros ou
avisos antes dos pushes. Os logs locais não foram versionados. Isso não
substitui o check obrigatório do GitHub antes da integração.

## Conferência da sessão dona antes de integrar

1. Revisar `9b9f856..HEAD` para este ciclo e `726f3bf..HEAD` para os cinco ciclos.
   O alvo continua sendo somente este branch, sem integração automática.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome disponíveis e
   conferir **Secret scan**. Este worker não executou nenhuma suíte de browser.
3. No app e no preview, atrasar uma leitura local de JSON e abrir Reset antes de
   ela terminar. A confirmação deve continuar sendo de Reset; confirmar limpa
   a comparação, cancelar conserva o rascunho, e erros antigos não reaparecem.
4. No visor restrito, iniciar uma cópia e exportar o JSON antes de ela terminar.
   A conclusão ou rejeição da cópia antiga deve preservar o JSON completo
   selecionado e o aviso da exportação. Conferir também a nova cópia seguinte.
5. Manter as conferências reais dos ciclos anteriores: cache online/offline,
   retomada v1, seleção repetida do mesmo arquivo, filas de salvamento,
   proteção de formatos futuros e efeitos reais de clipboard entre ações.

Conferido: pedido inteiro, histórico anterior, diffs, casos reproduzidos e
efeitos sobre consentimento e isolamento; ambas as correções com regressão
observada antes do ajuste; 101 testes isolados e 7 de servidor verdes; demo
com roundtrip exato; 13 artefatos sem drift; scanner sem achados.
