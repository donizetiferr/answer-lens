# Revisão local de correção — 25/10/2026

Branch exclusivo: `queima/2510-answer-lens`. Base: `726f3bf`.
Nenhuma alteração em main/master, CI, instruções ou controles de outras sessões.

## Pendências e limites

Nenhum item local selecionado ficou pendente. Não havia `CLAUDE.md`, `AGENTS.md`,
`evolution_plan.md`, backlog, specs, lotes ou TODO/FIXME no clone. A execução seguiu
pela auditoria do núcleo, importação/exportação, persistência, servidores e cache.

Browser, Windows, produção, dados pessoais, serviços externos e gastos ficaram
fora conforme o despacho. O único envio foi o push autorizado do próprio branch.
Os testes do worker executam seu código real em VM Node, com rede/cache/relógio
simulados; não certificam instalação, ativação e controle de páginas num browser.

## Entregas e commits

| Commit | Resultado | Regressão demonstrada |
| --- | --- | --- |
| `5eb6e0e` | Rejeita dias impossíveis e exige fuso explícito nos registros. Preserva anos bissextos e compara instantes pelos fusos. | Antes, `2026-02-29T04:00:00.000Z` era aceito e normalizado para março. O teste falhou antes do ajuste. |
| `6a7a07f` | Aplica o teto de 600.000 bytes UTF-8 também à função pura de importação. | Um JSON com texto multibyte excedia os bytes permitidos apesar de ter menos de 600.000 unidades de string. O teste falhou antes do ajuste; cobre também o limite exato com ASCII, acentos, CJK e emoji. |
| `f772442` | Revalida o shell online e atualiza a cópia offline; preserva a última cópia boa em falhas de rede ou HTTP. Cache indisponível não impede a resposta online. | Com arquivo antigo em cache, o worker devolvia esse arquivo sem consultar a rede. O teste de atualização falhou antes do ajuste. |
| `1e49ea1` | Quando há cópia offline, limita a espera pela rede a três segundos, incluindo a leitura completa do corpo. Recupera a cópia boa em transferências interrompidas. | A revisão da nova estratégia revelou espera sem prazo e falta de recuperação após cabeçalhos HTTP bem-sucedidos. Os testes falharam antes do ajuste. O relógio simulado cobre bloqueio antes dos cabeçalhos e durante o corpo, sem esperas reais. |
| `99c7076` | Preserva os formatos ISO válidos anteriormente aceitos: precisão fracionária maior, segundos omitidos e offset sem dois-pontos. | A revisão da validação inicial detectou restrição de formato desnecessária. Os casos válidos falharam antes desse ajuste; datas impossíveis e horários sem fuso continuam recusados. |

Cada correção recebeu commit próprio e push. Os módulos e workers gerados da
coleção `docs/design_refs/answer-lens/`, seus hashes e metadados foram sincronizados
em cada alteração correspondente. IDs, jornadas, isolamento de armazenamento e
versão de produto foram preservados. O README documenta a política nova de cache.

## Validação reproduzível

Ambiente de execução: Linux, Node `v24.16.0`; nenhuma instalação de pacote.

```sh
node scripts/run-gates.mjs
# 68 testes, 68 aprovados, zero falhas/cancelamentos/ignorados.

node --test tests/server.test.mjs
# 5 testes, 5 aprovados, zero falhas/cancelamentos/ignorados.

node scripts/sync-prototype.mjs --check
# checked: 13; updated: []; mode: check.

node scripts/demo.mjs
# JSON sintético válido e determinístico; roundtrip também coberto nos gates.

git diff --check 726f3bf..HEAD
# Sem erros de whitespace.
```

A base tinha 59 testes isolados e 5 de servidor, todos aprovados. Foram acrescidos
nove testes isolados. A cobertura existente de migração v1, notas opcionais,
consentimento, preservação de registros desconhecidos, conflitos entre abas,
texto inerte e isolamento do preview permaneceu verde.

A revisão final confrontou o pedido, os diffs e os casos reais reproduzidos:
calendário/fusos, tamanho do JSON em bytes, atualização com cache prévio, ausência
de rede, HTTP 404/503, falhas de abertura/leitura/escrita do cache, transferência
interrompida e conexão bloqueada. Os casos de worker rodam no app e no preview.
Pedidos fora da lista de arquivos, POSTs e URLs externas não são interceptados.
Não surgiu outro achado material reproduzível nessa varredura local.

## Conferência da sessão dona antes de integrar

1. Revisar os cinco commits como um conjunto, especialmente a troca da estratégia
   de cache. Não é um release: não houve bump de versão nem deploy.
2. Rodar `npm run test:all` no ambiente que já dispõe das dependências e Chrome.
   O worker não rodou as três suítes de browser por proibição explícita do despacho.
3. Conferir o ciclo real com cache antigo instalado: atualizar para o candidato,
   aguardar a ativação do worker, recarregar online e depois offline. Confirmar
   o mesmo comportamento no preview, mantendo seus caches e dados isolados.
4. Conferir a política de importação mais rigorosa: horários sem fuso e dias
   impossíveis são recusados. Exportações genuínas geradas pelo app continuam
   válidas; registros locais inválidos ficam protegidos, sem exclusão automática.

Conferido: revisão do autor, regressões observadas vermelhas antes das correções,
68 gates Node aprovados, 5 testes de servidor aprovados e 13 artefatos do protótipo
sem divergência. A integração e a validação de browser ficam com a sessão dona.
