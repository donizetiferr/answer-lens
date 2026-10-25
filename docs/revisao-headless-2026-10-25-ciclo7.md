# Revisão local de correção e cobertura — ciclo 7, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `51b59a3`.
Histórico e seis relatórios anteriores lidos antes da execução.
Código e testes conferidos em `7f7ccfe`, Linux, Node `v24.16.0`, às 02:51 BRT.

## Pendências e limites

Nenhum item local selecionado ficou pendente. Este clone continua sem backlog,
specs, lotes, TODO/FIXME ou instruções locais CLAUDE/AGENTS. A auditoria prosseguiu
pelo núcleo, importação/exportação, persistência, handlers, servidores e worker.
Não surgiu outro defeito material reproduzível que justificasse alteração de
runtime. Os itens deste ciclo acrescentam evidência de contratos existentes;
não são novas correções nem repetição dos achados dos ciclos anteriores.

Integração, check obrigatório **Secret scan** e execução real no navegador ficam
com a sessão dona. O despacho proíbe navegador: não houve captura, certificação
visual, teste de foco/seleção nativos, clipboard do sistema ou Web Locks reais.
Os testes de handlers executam o app e o preview com DOM, armazenamento e locks
controlados em Node. Os casos de texto verificam strings JavaScript e JSON,
sem certificar limites de renderização ou entrada nativa no browser.

Não houve Windows, credencial, produção, cliente, gasto, deploy ou merge.
Main/master, instruções, CI e controles de outras sessões permaneceram intactos.
Os únicos envios foram os pushes autorizados deste branch.

## Entregas

| Commit | Resultado e evidência |
| --- | --- |
| `eba280e` | Cobre a portabilidade de pergunta, duas respostas, duas origens e motivo com todos os campos no limite simultaneamente. São 16 combinações: dois padrões de texto, as duas atribuições A/B e os quatro vereditos. Os padrões incluem caracteres de controle que expandem no JSON, aspas, barras, acentos, CJK, emoji e surrogate isolado. O resultado permanece abaixo do teto em bytes UTF-8, reabre sem truncamento ou perda de campos e produz uma reexportação idêntica. Não exigiu mudança de runtime. |
| `7f7ccfe` | Acrescenta dois testes de troca de par, executados no app e no preview. Cancelar preserva o mesmo resultado revelado, ratings, motivo, texto alternativo de cópia, seleção, consentimento e bytes salvos. Confirmar mantém somente a pergunta, desliga o salvamento e informa a exclusão pendente sem alegar que ela já ocorreu. A pergunta retida solicita aviso antes de sair; uma edição feita enquanto o lock está ocupado conserva o próprio campo e foco após a limpeza. Um novo opt-in salva exatamente um rascunho novo, sem respostas, origens, notas, veredito, flag sintética ou atribuição anteriores. Não exigiu mudança de runtime. |

Cada item recebeu commit próprio e push. Foram alterados somente testes e este
relatório. O runtime e os 13 artefatos gerados do preview continuam idênticos
à base deste ciclo; não houve mudança de formato, versão, design ou release.

## Evidência reproduzível

```sh
node --test --test-name-pattern='maximum supported texts' tests/core.test.mjs
# 1 teste aprovado, com 16 combinações de exportação/importação.

node --test --test-name-pattern='next pair' tests/evolution.test.mjs
# 3 testes aprovados; inclui o teste puro preexistente e os dois testes novos.

node scripts/run-gates.mjs
# 108 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico. Exportação/importação/exportação exatas
# conferidas em execução separada, além do teste preexistente nos gates.

git diff --check 51b59a3..HEAD
# Sem erros de whitespace.
```

Base: 105 testes isolados e 7 de servidor. Acréscimo: três testes isolados,
com 20 cenários parametrizados. Os testes novos passaram sobre o runtime
existente; não há regressão observada vermelha nem alegação de bug corrigido.

A medição local de cobertura auxiliou a escolha dos casos. Ela não certifica
cobertura do app/worker executados em VM nem substitui a revisão dos handlers.

Gitleaks `8.30.1` foi reutilizado sem download. O arquivo do scanner foi conferido
contra o SHA-256 fixado pelo workflow, e o executável coincide com o contido
nesse arquivo. Árvore de trabalho e histórico completo disponível foram
examinados antes dos pushes com configuração confiável, supressões locais
desconsideradas e saída redigida, sem achados, erros ou avisos. Os logs locais
ficam fora do Git. Esse exame não substitui o check obrigatório da integração.

## Conferência da sessão dona antes de integrar

1. Revisar `51b59a3..HEAD` para este ciclo e `726f3bf..HEAD` para o conjunto.
   O worker fez push somente no branch de trabalho; a integração é da dona.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome disponíveis e
   conferir **Secret scan**. Este worker não abriu navegador.
3. Conferir no app e no preview o cancelamento e a confirmação de outro par
   com resultado salvo e texto alternativo de cópia aberto. Cancelar preserva
   o resultado; confirmar mantém somente a pergunta e exige novo opt-in.
   Com o lock ocupado por outra aba, o aviso de exclusão deve continuar pendente
   e uma edição do novo rascunho deve sobreviver à conclusão da limpeza.
4. Manter as verificações reais dos seis ciclos anteriores, sobretudo cache
   online/offline, migração v1, importações e cópias concorrentes, formatos
   protegidos e alterações de outra aba próximas à conclusão de uma exclusão.

Conferido: pedido inteiro, histórico anterior, diff restrito aos testes,
contratos de portabilidade, preservação de dados e consentimento na troca de
par; 108 testes isolados e 7 de servidor verdes; demo com roundtrip exato;
13 artefatos sem drift; scanner sem achados.
