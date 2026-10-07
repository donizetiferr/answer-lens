# Evidências da execução interna de 06/10

Todas as verificações usam dados sintéticos, servidores loopback efêmeros e contextos novos. Nada foi publicado em main/produção.

## Q1 — atualização offline

`npm run test:all`: 61 gates Node, 5 servidor e 44 testes Chromium, todos passando, sem skips. `node --permission --allow-fs-read=. scripts/run-gates.mjs`: 61 gates passando. `node scripts/sync-prototype.mjs --check`: 13 arquivos coerentes e revisão offline atual.

O teste `tests/offline.browser.test.mjs` serve duas gerações do shell no mesmo origin. Mantém rascunho salvo, seleção/foco e cache alheio durante a ativação, verifica remoção do cache antigo, depois revela e reabre offline com os novos bytes e o mesmo resultado. A segunda jornada interrompe o download de um ativo e prova que a versão anterior e o rascunho salvo continuam utilizáveis offline. A revisão também cobre mudanças no próprio worker e todas as adaptações do protótipo.

TELA: contexto local de `tests/offline.browser.test.mjs` | VI: resultado salvo restaurado offline, pergunta sintética preservada, fontes reveladas, avaliações omitidas como Not rated, ações de cópia/exportação e saving visíveis. PNG inspecionado: [resultado após atualização](design_refs/queima-0610/offline-upgrade-result.png). O rodapé “Offline upgrade after” é um marcador da fixture de duas versões, não texto enviado ao runtime real. Nivel: COMPLETO, alvo INTERNO; não se declara FINAL visual.

A verificação aguarda o estado `activated` do controlador antes de julgar a limpeza de caches. Um `controllerchange` sozinho ainda permite que o evento de ativação esteja em andamento. As execuções locais usam `CHROME_PATH` explícito e bibliotecas extraídas em diretório ignorado; nenhum pacote do sistema/serviço foi alterado. Logs brutos em `evidence/`, fora do Git.

## Q2 — qualidade automática

`npm run test:all` usando o Chromium padrão do Playwright: 61 Node, 5 servidor e 44 browser, todos passando, zero skips. O `CHROME_PATH` continua sendo um override opcional. A prova inclui o browser real, worker/offline, clipboard permitido/negado, isolamento do protótipo e o sandbox opaco. O parser YAML disponível leu o workflow; os SHA dos dois actions v6 foram conferidos com `git ls-remote` nos repositórios oficiais.

A execução mais rápida mostrou uma asserção preexistente que lia o erro antes do término de `File.text()`. O teste agora espera o alerta real, sem sleeps ou relaxar a mensagem esperada; a regressão direcionada e a suíte inteira passaram. O workflow executa gates em processo único com permissão de leitura restrita, servidores loopback e jornadas Chromium. Nenhuma ação de deploy, credencial ou upload de relatório foi acrescentada. Execução hospedada será anotada após push. Nivel: COMPLETO, alvo INTERNO.

O Secret scan do primeiro item passou no [run 37552160147](https://github.com/donizetiferr/answer-lens/actions/runs/37552160147), commit `284cd7a`.

### Q2-R — captura do favicon no runner

O [primeiro run de qualidade](https://github.com/donizetiferr/answer-lens/actions/runs/37552417010) passou nos dois jobs Node e em 43 de 44 jornadas Chromium. A última falhou em `Page.captureScreenshot` de um documento SVG standalone, depois de as duas decodificações 48×48 passarem. A correção mantém a decodificação e captura o mesmo SVG via elemento `img` numa página HTML real. Teste local direcionado: 1/1 pass, sem skips. O próximo run valida a correção no runner original; não se declara o primeiro run verde.

## Q3 — importação cancelada e atrasada

Três testes Chromium reproduziram as falhas antes da correção (0/3): file input mantinha o nome após cancelamento em 1440/390px e uma leitura atrasada trocava “Clear this comparison?” por “Open this result instead?”. Depois: 3/3 passes. `npm run test:all`: 61 Node + 5 servidor + 47 Chromium, zero falhas/skips. O input agora permite selecionar o mesmo arquivo físico novamente, e uma confirmação posterior invalida o pedido de arquivo pendente. Cancelar preserva exatamente os bytes do rascunho salvo; confirmar abre um resultado já revelado com saving off.

TELA: localhost, resultado aberto depois de cancelar e selecionar novamente o mesmo JSON | VI: selo Opened result · already revealed, razão sintética e fontes corretas, saving desmarcado; ações legíveis em desktop e empilhadas no mobile sem corte. PNGs inspecionados: [desktop](design_refs/queima-0610/import-retry-desktop.png) e [mobile](design_refs/queima-0610/import-retry-mobile.png). Nivel: COMPLETO; não se declara FINAL. O protótipo foi regenerado e preserva as adaptações do sandbox.

## Q4 — prontidão offline baseada no cache

As três regressões falharam antes e passaram depois: cache removido, cache incompleto, worker sem resposta. O teste também prova que o rascunho salvo fica byte a byte preservado e que a interface de 320px não transborda. `npm run test:all`: 61 Node + 5 servidor + 50 Chromium, todos passando, sem skips. O gate restrito de filesystem passou com 61 testes. A última captura direcionada teve 4/4 passes, incluindo o agregado de zero exceções/requisições externas/non-GET.

A consulta por MessageChannel envia somente um tipo fixo de pedido e recebe um booleano; o worker lê apenas os seus próprios ativos já definidos, sem criar cache vazio ou incluir qualquer pergunta/resposta. Ausência de resposta em três segundos é tratada como indisponibilidade. O rodapé revalida no carregamento, troca de worker e retorno à aba; a documentação explicita que isso é uma fotografia da disponibilidade, não garantia contra expulsão posterior.

TELA: localhost, rascunho salvo com cache removido/incompleto | VI: Saved on this device continua verdadeiro, campos e respostas preservados; rodapé informa Offline cache unavailable · keep this tab open, inclusive em 320px. Capturas inspecionadas: [desktop](design_refs/queima-0610/offline-unavailable-desktop.png), [mobile](design_refs/queima-0610/offline-unavailable-mobile.png). Nivel: COMPLETO, sem alteração da direção visual.

O [run 37552732805](https://github.com/donizetiferr/answer-lens/actions/runs/37552732805), commit `32489bb`, ficou verde: Node 22, Node 24 e todas as 47 jornadas Chromium, incluindo a captura real do favicon. O Secret scan também passou. Isso confirma Q2 e Q2-R no runner hospedado. O run intermediário de `c5c36f3` foi cancelado pelo push seguinte, não contado como sucesso.
