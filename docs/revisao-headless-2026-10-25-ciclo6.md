# Revisão local de correção — ciclo 6, 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base deste ciclo: `d81001c`.
Histórico e cinco relatórios anteriores conferidos antes da execução.
Código validado em `b97740d`, Linux, Node `v24.16.0`, às 02:44 BRT.

## Pendências e limites

Nenhum item local selecionado ficou pendente. O clone continua sem backlog,
specs, lotes, TODO/FIXME ou instruções locais CLAUDE/AGENTS. A execução seguiu
pela auditoria de correção e cobertura dos caminhos críticos, sem repetir as
correções dos ciclos anteriores. A conferência final do núcleo, persistência,
handlers, importação/exportação, servidores e worker não revelou outro achado
material reproduzível que exigisse correção neste ciclo.

Integração, check obrigatório **Secret scan** e validação real no navegador
ficam com a sessão dona. O despacho proíbe navegador: não houve captura nem
certificação de renderização, seleção, foco nativo, Web Locks ou entrega real
de eventos entre abas. Os testes executam os handlers reais em Node com DOM,
armazenamento e locks controlados; não demonstram o timing de um browser.

Não houve Windows, credencial, dado de produção, cliente, gasto, deploy ou
merge. Main/master, instruções, CI e controles de outras sessões permaneceram
intactos. Os únicos envios foram os pushes autorizados deste branch.

## Entregas

| Commit | Resultado e evidência |
| --- | --- |
| `3e51e48` | Corrige o retorno atrasado de uma exclusão: depois de outra aba alterar os dados, esse retorno podia trocar o estado `conflict` por `tab`, ou apagar o aviso de formato protegido. O teste novo falhou antes do ajuste com `tab !== conflict`. Agora o retorno registra a própria exclusão sem substituir o aviso mais recente nem reativar o consentimento. A regressão cobre sucesso/falha de exclusão, cópia externa comum/protegida e app/preview: oito cenários, preservando bytes externos, rascunho, foco e checkbox. |
| `b97740d` | Acrescenta três testes com 18 cenários sobre contratos já implementados. Escrita e Reset conferem a cópia efetiva sob o lock mesmo sem receber `storage`; uma confirmação já aceita perde validade se os bytes mudam durante a espera pelo lock; eventos de outra chave ou outra área de armazenamento não cancelam o salvamento. Todos rodam no app e no preview. A cópia externa pode ser válida, futura ou removida. A tentativa seguinte exige nova confirmação ou protege o formato futuro. Não foi necessária outra mudança de runtime. O README documenta a cobertura e seus limites. |

Cada item recebeu commit próprio e push. A alteração do runtime foi
sincronizada na coleção existente com hashes e metadados reproduzíveis.
IDs, jornadas, HTML, CSS, formato de dados, versão e isolamento de chaves,
locks e caches foram preservados. Não é release nem nova aprovação visual.

## Evidência reproduzível

```sh
node scripts/run-gates.mjs
# 105 testes aprovados; zero falhas, cancelamentos ou ignorados.

node --test tests/evolution.test.mjs
# 51 testes aprovados; subconjunto dos gates acima.

node --test tests/server.test.mjs
# 7 testes aprovados; zero falhas, cancelamentos ou ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético determinístico; roundtrip exato coberto nos gates.

git diff --check d81001c..HEAD
# Sem erros de whitespace.
```

Base: 101 testes isolados e 7 de servidor. Acréscimo: quatro testes isolados
com 26 cenários parametrizados. A regressão foi executada antes do ajuste;
os testes direcionados e os gates completos passaram após a correção.

Gitleaks `8.30.1` foi reutilizado sem download, com o arquivo conferido contra
o SHA-256 fixado pelo workflow. Árvore de trabalho e histórico completo
disponível foram examinados com configuração confiável, supressões locais
desconsideradas e saída redigida, sem achados. Os logs ficam fora do Git.
Esse exame local não substitui o check obrigatório antes de integrar.

## Conferência da sessão dona antes de integrar

1. Revisar `d81001c..HEAD` para este ciclo e `726f3bf..HEAD` para os seis ciclos.
   O worker fez push somente neste branch; a integração permanece com a dona.
2. Rodar `npm run test:all` no ambiente com Playwright e Chrome disponíveis e
   conferir **Secret scan**. Nenhuma suíte de browser foi executada aqui.
3. No app e no preview, conferir o aviso de conflito/proteção quando uma
   exclusão termina perto de uma alteração feita por outra aba. O retorno da
   exclusão deve preservar o aviso mais recente, o rascunho e o salvamento
   desligado. Testar também quando a exclusão é recusada pelo armazenamento.
4. Com uma aba segurando o Web Lock, confirmar uma substituição em outra e
   mudar novamente a cópia antes de liberar o lock. A confirmação antiga não
   deve sobrescrever os bytes novos; uma tentativa seguinte exige confirmação
   atualizada, e formato futuro permanece protegido.
5. Manter a conferência real dos ciclos anteriores: atualização online/offline,
   retomada v1, importações concorrentes, mesmo arquivo após cancelar,
   salvamento e cópia em operações concorrentes, incluindo o visor restrito.

Conferido: pedido inteiro, histórico, diffs, caso reproduzido antes da correção,
preservação de dados/consentimento e efeitos sobre o preview; 105 testes isolados
e 7 de servidor verdes; demo válida; 13 artefatos sem drift; scanner sem achados.
