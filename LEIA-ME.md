# SCAI • Versão Alfa 0.5.1

Leia também [MEMORIA-DO-PROJETO.md](MEMORIA-DO-PROJETO.md) para o registro permanente da conversa de origem, metodologia e decisões visuais.

Veja [os personagens da Versão Alfa 0.2](docs/personagens-realistas.md), aprovada e integrada à `main`, com capturas reais, materiais e validação. Os três modelos receberam rosto, cabelo, alfaiataria, mãos e materiais novos, com deformação das articulações na GPU. Para conferir os testes de geometria, animação e câmera, execute `node --test tests/personagens.test.cjs tests/camera.test.cjs`.

**Entrada:** abrir `SCAI.html` no Chrome, Edge ou Firefox moderno. O jogo também pode ser servido por qualquer servidor estático (recomendado para distribuição), por exemplo `python -m http.server 8000` dentro da pasta SCAI e então acessar `http://localhost:8000/SCAI.html`.

## Estrutura

- `SCAI.html` — tela principal, apresentação, central de fases.
- `SCAI.css` / `SCAI.js` — visual e navegação da central.
- `engine3d.js` — movimento, colisões, enquadramento e câmera da fase.
- `assets/malha.js` / `assets/cenario.js` — malhas suaves, mobiliário, vegetação, arquitetura e equipamentos do escritório e galpão.
- `assets/personagens.js` — auditor, Marcos e operador, com modelos em coordenadas locais e esqueleto articulado.
- `assets/renderizador.js` / `assets/iluminacao.js` — renderização WebGL, iluminação, materiais e sombras do mobiliário.
- `assets/materiais.js` — atlas de madeira, pedra, tecido, couro, papelão, alumínio, concreto e reboco, criado com ImageGen e incorporado ao pacote.
- `assets/graficos.js` / `assets/horizonte.js` — placas, documentos, monitores, etiquetas e panorama das janelas, incorporados para execução offline.
- `fases/fase01.html` — fase isolada (pode ser aberta diretamente).
- `fases/fase01.css` / `fases/fase01.js` — interface e regras pedagógicas da fase.
- `assets/` — imagens de apresentação e recursos do cenário tridimensional. As janelas usam um panorama distante e os objetos exploráveis usam malhas 3D.

## Controles

Na Versão Alfa 0.5.1, **Q** aciona as conversas e procedimentos da missão. **E** usa cadeiras, portas, a conversa com o trabalhador e a empilhadeira. Os botões de ação também funcionam por toque. Ao sentar, o auditor fica ancorado à cadeira; pressione E novamente para levantar. A câmera continua livre. Veja [cadeiras e porta de vidro](docs/cadeiras-e-porta.md) para os controles, capturas e validação.

O funcionário do galpão fica sentado atrás da mesa. Ao encostar nele ou na bancada, use **E / Conversar**: o auditor caminha até a frente, o trabalhador vira só a cabeça e fala com legenda a 30 caracteres por segundo. Ao terminar, use **Encerrar conversa** ou E para ele voltar ao documento. A conversa não altera créditos nem objetivos. Sua cadeira permanece ocupada; as oito cadeiras do escritório continuam disponíveis para o jogador.

As janelas receberam o mesmo vidro da porta e o panorama envolve o prédio em uma cobertura externa afastada, criando profundidade em relação aos caixilhos e preenchendo as vistas laterais e para baixo. Veja a [prévia e validação das janelas](docs/janelas-de-vidro.md).

No celular, os botões **Missão** e **Trabalho** abrem os respectivos painéis do topo, que começam recolhidos. Use ×, **Recolher** ou toque novamente no botão para fechá-los. A pergunta fica fixa durante a escolha das respostas. Veja as capturas e a validação em [Interface em celulares](docs/interface-celular.md).

**Computador:** WASD ou ↑↓ para caminhar, ←→ ou arrastar com mouse para girar câmera, Q para interagir. **Celular/tablet:** botões direcionais, botões de câmera, arrastar o dedo na cena e botão Interagir. O botão **Localizar objetivo** procura um teste pendente e acessível pelo saldo, gira o auditor e a câmera em sua direção e indica os pontos com marcadores 3D baixos, fixos ao piso (laranja pendente e verde concluído); não teletransporta o personagem.

O objetivo **Painel de indicadores** fica em frente ao armário baixo com pastas e livros no escritório. Ao concluir a missão com sucesso, a etapa **Avaliação** fica verde e recebe ✓, como as etapas anteriores.

## Conteúdo funcional no alfa

1. Tutorial introdutório; salas e galpão exploráveis em 3D, agora com teto alto completo, painéis acústicos, estrutura de suporte e luminárias; auditor controlável, gestor e funcionário, com personagens arredondados, rostos e vestuário detalhados em geometria leve. A câmera se aproxima somente para evitar paredes e divisórias; apenas quando essa aproximação fica muito curta, oculta o auditor. Móveis e outros personagens não provocam zoom: ficam invisíveis enquanto a câmera os atravessa e reaparecem ao sair. A caminhada do auditor continua bloqueada por paredes, móveis, cadeiras, estantes, paletes, bancadas, equipamentos e pessoas. Veja [a revisão da câmera e do polegar](docs/camera-e-polegar.md). Na entrevista, uma faixa inferior ocupa 50% da tela em celulares e 25% em tablets/computadores, a fala do gestor aparece a 30 caracteres por segundo e o feedback pedagógico surge instantaneamente; a boca se anima apenas durante a fala do gestor. As opções surgem quando a fala termina e usam fonte de 16 px, igual à fala. O enquadramento aproxima o gestor e oculta temporariamente o auditor para deixar o rosto livre; a câmera retorna ao encerrar a conversa.
2. Duas perguntas de entrevista com escolhas alternativas e feedback imediato.
3. Plano com cinco opções de teste e seleção única por caixa de marcação, sem prioridade ou repetição. Orçamento de 8 créditos: custo exato de documentos, contagem, cálculo e indicadores (2 + 3 + 2 + 1).
4. Cada teste só pode ser executado uma vez; rever resultados é grátis. Teste fora do plano registra uma mudança, sem crédito extra ou desconto na nota. O saldo limita a execução, e testes pouco úteis podem impedir a conclusão na tentativa atual.
5. Conclusão com quatro tipos de relatório, explicados em linguagem simples. Aprovação exige os quatro testes úteis e a opinião adequada. Nota: até 80 pontos pelos testes (documentos 25%, contagem 35%, cálculo 30%, indicadores 10%), 15 pelo relatório e 5 pela entrevista. Fornecedor não pontua neste caso. A avaliação explica resultados, omissões e motivo da conclusão.
6. Configuração Eco para reduzir resolução interna e limitar desenho a cerca de 30 FPS. O cenário mantém as malhas na GPU, compartilha atlas de superfícies e sinalização e calcula uma vez as sombras do mobiliário. A iluminação combina luz fria das janelas e luz quente do interior.

## Limitações assumidas do protótipo

- **Uma única empresa/caso**, fixo e fictício: Aurora Distribuição S.A., com opinião esperada com ressalva. A rotação aleatória sem repetição dos quatro modelos de relatório é uma **meta de versões futuras**, ainda não implementada.
- A aparência usa uma adaptação das referências Clean Stylized 3D para renderização interativa em WebGL 1. O acabamento combina geometria suave, superfícies compartilhadas e iluminação simplificada.
- O elenco usa esqueleto articulado para caminhada, gestos e animação da boca. A fala do gestor é apresentada por texto a 30 caracteres por segundo.
- Conteúdo normativo simplificado e ilustrativo; a terminologia técnica e critérios de opinião precisam ser revisados à luz das NBC TAs e atualizados antes do uso curricular formal.
- A fase contém um mecanismo de avaliação didático, não um mecanismo real de mensuração estatística de amostragem ou risco de auditoria. Não utiliza dados reais de empresas.
- O suporte depende de navegador com WebGL disponível; não é possível assegurar funcionamento em *todos* os dispositivos. Arquivos HTML podem ser bloqueados por configurações específicas de navegador; servir localmente costuma ser mais confiável.

## Conferência do upgrade visual

A missão foi percorrida até o resultado no Microsoft Edge, com abertura pelo menu e diretamente pelo arquivo da fase. Foram conferidos entrevista, feedback instantâneo, metas e saldo, mudanças de plano sucessivas, marcadores e relatório. A cena rodou a aproximadamente 60 FPS a 1180 × 756 em Intel UHD Graphics neste computador. O layout foi conferido em viewport de 390 × 844 com perguntas e respostas em 16 px e diálogo ocupando 50% da altura; tablets e computadores mantêm 25%. O desempenho em um celular físico ainda requer conferência.

## Consulta visual do tablet

Pressione **F** ou o botão F nos controles de toque para consultar o tablet, em pé ou sentado. O auditor levanta o braço, olha para gráficos e números decorativos durante três segundos e retorna à pose anterior com a tela apagada. O movimento fica suspenso durante a consulta; saldo e missão não são alterados. A função integra a Versão Alfa 0.3.2, junto com o alinhamento da tela ao rosto. As alternativas da entrevista são embaralhadas a cada pergunta; pontuação e feedback seguem o conteúdo escolhido.

## Revisão de textos e planejamento · Alfa 0.4.2

Versão Alfa 0.4.2 registrada em `codex/teste-nova-implementacao`, com integração à main autorizada pelo autor. Menu, introdução, entrevista, objetivos, planejamento, execução, relatório, avaliação e sinalização do cenário usam textos revisados. Alternativas da entrevista permanecem embaralhadas, com caminhos plausíveis e retorno específico. A fala mantém 30 caracteres por segundo; feedback permanece instantâneo.

Validação da revisão: `node --test tests/textos-plano.test.cjs tests/interacoes.test.cjs tests/camera.test.cjs` e `python tests/textos-plano-runtime.py`. O fluxo de navegador cobre computador, celular e tablet emulados, execução fora do plano, consulta gratuita, saldo insuficiente, aprovação e revisão.

Referência para as distinções entre relatórios: [NBC TA 700/705, CFC](https://cfc.org.br/wp-content/uploads/2018/04/Publicacao_NBC_TA_AUDITORIA.pdf). As regras de créditos, pesos e conclusão são escolhas didáticas deste jogo.

## Galpão de expansão e porta de enrolar · Alfa 0.5

Na ramificação `codex/teste-nova-implementacao`, o painel ao lado da porta metálica oferece **E / Abrir porta / Fechar porta**. Há um painel equivalente do outro lado; os dois comandam a mesma porta. As lâminas sobem e recolhem na caixa superior. Aproximar-se não aciona a porta, e um fechamento solicitado pausa se alguém estiver no vão.

Atrás da porta há um galpão fechado, com piso de concreto igual ao existente, cerca de **80 × 55 unidades** e altura de 10,8 unidades. Piso livre de cargas e móveis, estrutura no perímetro e sob o teto, preparado como espaço para futuras implementações. A empilhadeira pode ser dirigida por E / Entrar: W/S para frente e ré, A/D para virar e E / Sair para estacionar e desembarcar. No celular, use as setas de movimento e o botão de ação. Veja [a prévia e os controles](docs/galpao-expansao.md). Recurso da Versão Alfa 0.5 na ramificação de desenvolvimento, sem integração à main.

Conversa do trabalhador validada com trajetos de frente/lados/costas, corpo e braços preservados durante a fala, retorno suave da cabeça e interface em computador/celular emulados. Prévia em [conversa do trabalhador](docs/previa-conversa-trabalhador.jpg).

## Empilhadeira dirigível · Alfa 0.5.1

Encoste no veículo e use **E / Entrar**. O auditor caminha até a lateral mais próxima que esteja livre, sobe e senta. A mão esquerda acompanha o aro do volante; a direita mantém o tablet. **W/↑** acelera para frente, **S/↓** dá ré, **A/D** vira a direção. As setas curvas continuam girando a câmera. Soltar o acelerador freia; seguir reto centraliza o volante. **E / Sair** para o veículo e procura uma lateral livre para desembarcar.

Rodas e pneus giram pela distância real de cada roda, com velocidades diferentes nas curvas e sentido invertido na ré. Colisões impedem avanço e giro de pneus quando bloqueado. O veículo fica parado na posição e orientação em que foi deixado; seu local original fica livre. Não há operação dos garfos nem transporte de cargas nesta implementação. A cabine foi ajustada ao tamanho do auditor. [Prévia](docs/previa-empilhadeira-dirigivel.jpg).

Implementação registrada na ramificação `codex/teste-nova-implementacao` como Versão Alfa 0.5.1, sem fusão à main.

### Revisão do embarque e do tablet

A subida usa apoios independentes: um pé no degrau lateral, o outro no piso da cabine e depois os dois pés dentro antes de sentar, com o corpo abaixado para passar sob o teto. O desembarque inverte a sequência. **F** e o botão F também funcionam enquanto dirige, mantendo a mão esquerda no volante e os comandos do veículo ativos. A velocidade máxima passou de 5 para 10 unidades/s à frente e de 2,6 para 5,2 unidades/s na ré; aceleração e freio acompanham o aumento. [Embarque](docs/previa-embarque-empilhadeira.jpg) · [Tablet durante a direção](docs/previa-tablet-dirigindo.jpg).
