# SCAI • Versão Alfa 0.3.5

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

Na Versão Alfa 0.3.5, integrada à **main**, **Q** aciona as conversas e procedimentos da missão. **E** usa cadeiras e a porta dupla entre o escritório e o galpão. Os botões de ação também funcionam por toque. Ao sentar, o auditor fica ancorado à cadeira; pressione E novamente para levantar. A câmera continua livre. Veja [cadeiras e porta de vidro](docs/cadeiras-e-porta.md) para os controles, capturas e validação.

O funcionário do galpão fica sentado atrás da mesa, em pose de trabalho, sem diálogo ou interação. Sua cadeira permanece ocupada; as oito cadeiras do escritório continuam disponíveis para o jogador.

No celular, os botões **Missão** e **Trabalho** abrem os respectivos painéis do topo, que começam recolhidos. Use ×, **Recolher** ou toque novamente no botão para fechá-los. A pergunta fica fixa durante a escolha das respostas. Veja as capturas e a validação em [Interface em celulares](docs/interface-celular.md).

**Computador:** WASD ou ↑↓ para caminhar, ←→ ou arrastar com mouse para girar câmera, Q para interagir. **Celular/tablet:** botões direcionais, botões de câmera, arrastar o dedo na cena e botão Interagir. O botão **Localizar objetivo** procura um teste pendente e acessível pelo saldo, gira o auditor e a câmera em sua direção e indica os pontos com marcadores 3D baixos, fixos ao piso (laranja pendente e verde concluído); não teletransporta o personagem.

## Conteúdo funcional no alfa

1. Tutorial introdutório; salas e galpão exploráveis em 3D, agora com teto alto completo, painéis acústicos, estrutura de suporte e luminárias; auditor controlável, gestor e funcionário, com personagens arredondados, rostos e vestuário detalhados em geometria leve. A câmera se aproxima somente para evitar paredes e divisórias; apenas quando essa aproximação fica muito curta, oculta o auditor. Móveis e outros personagens não provocam zoom: ficam invisíveis enquanto a câmera os atravessa e reaparecem ao sair. A caminhada do auditor continua bloqueada por paredes, móveis, cadeiras, estantes, paletes, bancadas, equipamentos e pessoas. Veja [a revisão da câmera e do polegar](docs/camera-e-polegar.md). Na entrevista, uma faixa inferior ocupa 50% da tela em celulares e 25% em tablets/computadores, a fala do gestor aparece a 30 caracteres por segundo e o feedback pedagógico surge instantaneamente; a boca se anima apenas durante a fala do gestor. As opções surgem quando a fala termina e usam fonte de 16 px, igual à fala. O enquadramento aproxima o gestor e oculta temporariamente o auditor para deixar o rosto livre; a câmera retorna ao encerrar a conversa.
2. Duas perguntas de entrevista com escolhas alternativas e feedback imediato.
3. Gestão de risco com cinco técnicas, metas e prioridades, orçamento de 12 pontos técnicos e plano não obrigatório na quantidade.
4. Execução no ambiente 3D: testes planejados ou fora da meta podem ser executados se houver saldo; cada teste consome seus próprios pontos e uma execução fora da meta registra +1 mudança de plano, sem conceder créditos; constatações registradas.
5. Emissão de uma das quatro opiniões e avaliação comparativa: aprovação somente com opinião correta E cobertura de pelo menos 70% das quatro técnicas relevantes; tela de resultados com feedback explicativo.
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
