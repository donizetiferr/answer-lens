# Revisão local de correção — ciclo 4, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `a83bc7e`.
O histórico e os três relatórios anteriores foram lidos antes da execução.
Código e testes conferidos em `c7a9f6d`, Linux, Node `v24.16.0`, às 02:25 BRT.

## Pendências e limites

Nenhum item local selecionado ficou pendente. O clone continua sem backlog,
specs, lotes, TODO/FIXME ou instruções locais CLAUDE/AGENTS. A execução seguiu
pela auditoria de correção e cobertura dos caminhos críticos ainda disponíveis.
Não surgiu outro achado material reproduzível na varredura final deste ciclo.

A sessão dona precisa fazer a validação real no navegador e conferir o check
obrigatório **Secret scan** antes de integrar. Este despacho proibiu navegador;
os testes de handlers usam DOM e APIs controlados em Node e não certificam
renderização, foco nativo, diálogos, seletor de arquivos ou entrega real de
eventos entre abas. Nenhuma nova evidência visual foi produzida.

Não houve Windows, credencial, dado de produção, cliente, gasto, deploy, merge
ou alteração de main/master. CI, instruções e controles de outras sessões
permaneceram intactos. Os únicos envios foram os pushes autorizados do branch.

## Itens entregues

| Commit | Resultado e evidência |
| --- | --- |
| `045eeb6` | Corrige o bloqueio persistente de salvamento após outra aba restaurar exatamente a cópia anterior a um registro protegido. O filtro de eventos iguais ignorava a mudança de proteção. A regressão falhou antes do ajuste com o checkbox ainda desabilitado. Cobre restauração de cópia válida e remoção de registro quando a origem estava vazia. Preserva rascunho e foco, mantém consentimento desligado e exige confirmação antes de salvar novamente. |
| `95edaad` | Acrescenta dois testes locais de importações concorrentes. Uma leitura antiga, bem-sucedida ou rejeitada, não pode substituir um resultado mais recente nem apagar o erro de um arquivo novo inválido. Confere conteúdo copiado, rascunho, ausência de confirmação indevida, liberação do input e ausência de gravação. São quatro cenários de cobertura de contratos existentes; nenhum novo defeito de runtime foi encontrado nesses casos. |
| `c7a9f6d` | Acrescenta um teste de retomada por handlers reais de rascunho e comparação cega v1, produzidos com o núcleo antigo congelado. Confere abertura explícita, preservação de respostas, atribuição, nota, veredito e rating parcial; consentimento antigo não é adotado. Depois da revelação, somente uma nova escolha permite salvar em v2, e Reset preserva o registro v1 original. Cobertura complementar, sem outra mudança de runtime. |

Todos os itens receberam commit próprio e push. A correção do app foi
sincronizada na coleção existente, com hashes e metadados reproduzíveis.
IDs, jornadas, HTML, CSS, armazenamento e caches isolados, versão e formato
do produto foram preservados. Não houve release.

## Evidência reproduzível

```sh
node scripts/run-gates.mjs
# 94 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/evolution.test.mjs
# 40 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico; roundtrip exato também coberto nos gates.

git diff --check a83bc7e..HEAD
# Sem erros de whitespace.
```

Base: 90 testes isolados e 7 de servidor. Acréscimo: quatro testes isolados,
com oito cenários parametrizados. A suíte completa isolada permaneceu verde.

Gitleaks `8.30.1` foi reutilizado do ciclo anterior, sem novo download. O arquivo
do scanner foi conferido contra o SHA-256 fixado pelo workflow do projeto.
Com configuração confiável, supressões locais desconsideradas e saída redigida,
o scanner conferiu histórico completo disponível e árvore de trabalho antes
dos pushes, sem achados, erros ou avisos. O clone não é raso. Logs do scanner
e arquivos temporários não foram versionados.

## Conferência da sessão dona antes de integrar

1. Revisar `a83bc7e..HEAD` para este ciclo e `726f3bf..HEAD` para o conjunto
   dos quatro ciclos. O alvo do worker continua sendo somente este branch.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome; conferir
   **Secret scan**. Não houve execução das suítes de browser neste ciclo.
3. No app e no preview, com rascunho em foco, fazer outra aba gravar um formato
   incompatível e depois restaurar exatamente os bytes da cópia anterior.
   Conferir a mesma sequência quando antes não existia cópia salva e a outra
   aba remove o registro incompatível. A escolha de salvar deve ser liberada,
   com rascunho e foco preservados, checkbox desmarcado e confirmação explícita.
4. Manter as verificações reais dos ciclos anteriores: cache online/offline,
   retomada v1, repetição do mesmo arquivo após cancelar, filas de salvamento
   e retorno tardio da cópia. Os testes locais novos ampliam a cobertura dessas
   jornadas, sem substituir a execução nativa no browser.

Conferido: regressão observada antes do ajuste; revisão do autor sobre pedido,
histórico, diffs, consentimento e efeitos entre abas; 94 testes isolados e 7 de
servidor verdes; demo e 13 artefatos sem drift; scanner sem achados.
