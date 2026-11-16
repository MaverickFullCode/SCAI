# Experimento visual dos personagens

Implementação em `codex/teste-nova-implementacao`, baseada na referência de auditor em estilo Clean Stylized 3D. O experimento mantém o elenco da fase Aurora: auditor, Marcos e operador. O resultado é uma interpretação estilizada em tempo real da referência.

![Auditor renderizado dentro da fase](previa-auditor.png)

## O que mudou

- Rosto com o comprimento e a proporção da versão anterior ao experimento, mantendo ponte e asas do nariz esculpidas, maçãs do rosto, olhos amendoados e íris texturizada. A expressão de repouso é neutra, com lábios fechados; os dentes são revelados somente durante a fala.
- Cabelo restaurado ao molde compacto da versão anterior, com as mechas largas e a cor castanha originais. As linhas de envelhecimento em relevo de Marcos foram removidas. Ele conserva os fios grisalhos e a barba aparada; o operador conserva o capacete e o colete. Pele e cabelo voltaram à paleta e à resposta de iluminação anteriores.
- Paletó e calças com superfícies contínuas nas articulações, pregas discretas, lapelas com dobra, bolsos, costuras e colarinho ajustado. Sapatos com acabamento de couro e cadarços; cinto com fivela retangular.
- Mãos reconstruídas como uma única superfície fechada: punho, palma, espaços entre os dedos e polegar compartilham a mesma geometria. As unhas acompanham a superfície dos dedos. O tablet segue verticalmente ao lado da coxa, ligado ao mesmo antebraço; o polegar nasce na base da palma, abaixo do punho, e envolve a borda superior. A altura do tablet foi ajustada a esse apoio, sem atravessar a pele. Veja [a revisão do encaixe](camera-e-polegar.md).
- Deformação por dois ossos nos cotovelos, joelhos, quadril e pescoço. Mandíbula e lábio acompanham a fala e voltam à boca fechada quando ela termina; ambos os olhos piscam a cada 4 segundos de tempo real, sem depender da velocidade da simulação.
- Roupas, acessórios e olhos conservam os materiais do experimento. Pele e cabelo usam o acabamento suave anterior. O cenário mantém a iluminação existente.

![Elenco renderizado para inspeção dos modelos](previa-elenco.png)

As capturas acima são renderizações WebGL dos modelos implementados. A primeira usa o escritório da fase e um enquadramento de inspeção, com o HUD oculto; a segunda reúne o elenco sobre um fundo neutro para comparação. As câmeras usadas nas capturas não modificam a câmera de exploração do jogo.

## Materiais

O [atlas do elenco](../assets/elenco-atlas.webp) contém oito superfícies: pele, lã azul, camisa azul clara, lã cinza, cabelo castanho, couro preto, couro marrom e íris castanha. `assets/elenco-materiais.js` incorpora a mesma imagem para permitir a abertura por arquivo local, sem depender de download ou CORS. O renderizador prepara a textura com mipmaps; detalhes mais finos perdem intensidade à distância para reduzir cintilação.

Após a revisão do autor, os quadrantes de pele e cabelo deixaram de modular esses materiais: suas cores e iluminação voltaram ao acabamento anterior. Os demais quadrantes continuam em uso. As mãos são modeladas uma vez, compartilhadas entre os personagens e mantidas em buffers da GPU durante o jogo.

Foi usado o modo integrado da habilidade `imagegen`. A imagem gerada foi codificada em WebP para distribuição. Prompt utilizado:

> Use case: stylized-concept. Asset type: production albedo texture atlas for real-time Clean Stylized 3D human game characters. Create one perfectly rectangular 4-column by 2-row atlas, 8 equal square tiles, tightly aligned at x=25%,50%,75% and y=50%, no borders, no gutters, no labels, no text. Overall landscape 2:1. Each tile is a full flat orthographic material swatch, diffuse albedo only, no perspective, no shadows, no objects, no folds or lighting gradients. Upper row left to right: (1) subtly warm beige human facial skin, natural very fine pores and extremely subtle tonal variation, smooth sophisticated semi-realistic finish, no wrinkles or facial features, NOT leather; (2) deep navy blue fine tailored suit wool, very fine uniform high-end twill; (3) pale powder blue cotton shirt poplin, extremely fine delicate weave; (4) neutral dark charcoal grey tailored trouser wool, fine subtle weave. Lower row left to right: (5) dark chestnut brown hair fibers in softly curving parallel diagonal strands, restrained copper undertones, no scalp or silhouette; (6) very dark graphite black polished oxford shoe leather, extremely fine soft grain, flat diffuse not shiny highlights; (7) medium brown premium belt/watchband leather, fine smooth grain with subtle pores; (8) one centered straight-on amber brown human iris filling the square with radial fibers, dark brown limbal edge and a pure black circular pupil of 30% of iris diameter, detailed subtle gold/olive fibers, no eyelids, no sclera, no highlights or catchlights. Style: smooth sophisticated semi-realistic corporate character materials, refined and clean, not gritty or noisy. Consistent neutral light, no baked specular or glossy highlights anywhere. All material tiles except iris should tile seamlessly with their own opposite edges. This is a raw game texture sheet, never an illustration of a person or environment.

## Validação

`node --test tests/personagens.test.cjs` verifica 21 casos: integridade das malhas e influências do esqueleto para cada personagem, poses finitas ao girar/caminhar/falar, comprimento preservado do rosto, boca fechada em repouso e animada na fala, continuidade das duas mãos de cada personagem, apoio do pé durante o avanço, solas acima do chão, altura da postura, ancoragem do tablet, sua posição abaixo da cintura, encaixe do polegar sem atravessar o tablet e piscadas de ambos os olhos a cada 4 segundos mesmo com a simulação parada. O teste das mãos exige uma única superfície de pele conectada e sem bordas abertas, incluindo todos os dedos e o polegar. Os modelos usam índices de 16 bits no WebGL 1 e um desenho por personagem.

A fase foi aberta diretamente e pelo menu no Edge com WebGL real. A missão foi percorrida até o resultado aprovado, incluindo entrevista a 30 caracteres por segundo, feedback instantâneo, execução de testes fora do plano e cinco mudanças de plano sem criar créditos. Os três personagens foram conferidos de frente, de perfil e por trás; caminhada, fala e piscada foram renderizadas sem erro de WebGL. O layout foi conferido com emulação, com fonte de 16 px e faixa de diálogo de 50% da altura nos celulares e 25% em tablets/computadores. Veja [a interface do celular](interface-celular.md).

A inicialização, a renderização e a exibição dos controles de toque também passaram no WebKit com emulação móvel de 430 × 932, sem erro de WebGL. A medição final no Edge ficou em aproximadamente 60 FPS a 1180 × 756, com Intel UHD Graphics neste computador.

O desempenho e a aparência em aparelhos físicos continuam sujeitos à GPU, resolução e navegador. A referência é um render de estúdio; este experimento usa geometria e iluminação interativas em WebGL 1 e deve ser avaliado visualmente nessa ramificação antes de integração.
