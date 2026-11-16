/* Superfícies gráficas da Aurora. Coordenadas em pixels, com a origem no alto da textura. */
(function (global) {
  'use strict';

  const width = 2048, height = 1024;
  const tiles = {
    dashboard: [4, 4, 768, 432],
    workstation: [780, 4, 496, 279],
    office: [780, 291, 496, 144],
    distribution: [1284, 4, 760, 280],
    carton: [1284, 292, 272, 136],
    aisleA: [1564, 292, 140, 140],
    aisleB: [1712, 292, 140, 140],
    aisleC: [1860, 292, 140, 140],
    window: [4, 444, 1536, 576],
    document: [1548, 444, 400, 560]
  };
  let atlas, ready;
  const fontFamily = '"Segoe UI", Arial, sans-serif';
  const tau = Math.PI * 2;

  function gradient(ctx, x, y, endX, endY, stops) {
    const grad = ctx.createLinearGradient(x, y, endX, endY);
    stops.forEach(([at, color]) => grad.addColorStop(at, color));
    return grad;
  }
  function rect(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  function text(ctx, value, x, y, size, color, weight = 500, align = 'left') {
    ctx.font = weight + ' ' + size + 'px ' + fontFamily;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }
  function circle(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, tau);
    ctx.fill();
  }
  function polygon(ctx, points, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fill();
  }
  function panel(ctx, x, y, w, h, radius, fill, border) {
    ctx.beginPath();
    ctx.moveTo(x+radius, y);
    ctx.arcTo(x+w, y, x+w, y+h, radius);
    ctx.arcTo(x+w, y+h, x, y+h, radius);
    ctx.arcTo(x, y+h, x, y, radius);
    ctx.arcTo(x, y, x+w, y, radius);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (border) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = border;
      ctx.stroke();
    }
  }
  function barsLogo(ctx, x, y, size, fill) {
    const unit = size / 48;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(unit, unit);
    for (let i = 0; i < 3; i++) {
      rect(ctx, 1 + i * 11, 24 - i * 9, 7.5, 15 + i * 9, fill);
    }
    // The lens and handle clear the bars in silhouette even on a small laptop lid.
    ctx.beginPath();
    ctx.arc(33, 31, 9, 0, tau);
    ctx.strokeStyle = fill;
    ctx.lineWidth = 3.7;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(40, 38);
    ctx.lineTo(48, 46);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
  function cubeLogo(ctx, x, y, s, colors) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    polygon(ctx, [[0,-.49],[.44,-.25],[0,-.01],[-.44,-.25]], colors[0]);
    polygon(ctx, [[-.46,-.18],[-.05,.04],[-.05,.49],[-.46,.25]], colors[1]);
    polygon(ctx, [[.05,.04],[.46,-.18],[.46,.25],[.05,.49]], colors[2]);
    ctx.restore();
  }

  function dashboard(ctx) {
    rect(ctx, 0, 0, 768, 432, gradient(ctx, 0, 432, 700, -80, [[0,'#123352'], [.55,'#123b69'], [1,'#225b98']]));
    barsLogo(ctx, 26, 20, 43, '#8edffd');
    text(ctx, 'Visão geral da auditoria', 85, 55, 35, '#f0f8ff', 630);
    text(ctx, 'AURORA  /  DISTRIBUIÇÃO S.A.', 86, 79, 14, '#9ec8e7', 650);
    rect(ctx, 26, 99, 716, 1, '#5f86a6');
    text(ctx, 'Custo dos procedimentos', 28, 139, 25, '#f5faff', 610);
    text(ctx, 'Pontos técnicos por aplicação', 29, 162, 15, '#bad3e8');
    const tests = [['Docs.',2], ['Cont.',3], ['Recálc.',2], ['Anál.',1], ['Conf.',3]];
    const barFill = gradient(ctx, 0, 200, 0, 340, [[0,'#67dafa'],[1,'#278acb']]);
    for (let tick = 0; tick < 4; tick++) {
      const y = 325 - tick * 43;
      rect(ctx, 58, y, 342, 1, '#416483');
      text(ctx, String(tick), 46, y + 4, 13, '#9fbcd7', 500, 'right');
    }
    tests.forEach(([label, cost], i) => {
      const x = 76 + i * 66, barHeight = cost * 43;
      rect(ctx, x, 325 - barHeight, 35, barHeight, barFill);
      rect(ctx, x, 325 - barHeight, 35, 2, '#97e5fa');
      text(ctx, label, x + 17, 349, 15, '#d7e9f7', 500, 'center');
    });
    rect(ctx, 419, 124, 1, 232, '#436688');
    text(ctx, 'Técnicas por custo', 444, 139, 24, '#f4f9ff', 610);
    const categories = [['1 PT',1,'#ffe39a'], ['2 PT',2,'#58d3dd'], ['3 PT',2,'#61a8f1']];
    let angle = -Math.PI / 2;
    categories.forEach(([name, count, color], i) => {
      const end = angle + tau * count / 5;
      ctx.beginPath();
      ctx.arc(540, 250, 66, angle + .026, end - .026);
      ctx.strokeStyle = color;
      ctx.lineWidth = 21;
      ctx.stroke();
      angle = end;
      circle(ctx, 641, 219 + i * 32, 5, color);
      text(ctx, name, 657, 225 + i * 32, 17, '#dbedfa');
    });
    text(ctx, '5', 540, 261, 46, '#ffffff', 620, 'center');
    text(ctx, 'TÉCNICAS', 540, 282, 12, '#a3c8df', 650, 'center');
    panel(ctx, 27, 373, 715, 40, 5, '#173a5b', '#447394');
    rect(ctx, 43, 386, 4, 14, '#73d2e7');
    text(ctx, 'PLANEJAMENTO', 58, 399, 14, '#9fc6df', 700);
    text(ctx, 'Orçamento inicial', 230, 399, 16, '#d1e2f3');
    text(ctx, '12 pontos técnicos', 720, 400, 20, '#ffffff', 650, 'right');
  }
  function workstation(ctx) {
    rect(ctx, 0, 0, 496, 279, gradient(ctx, 0, 279, 496, 0, [[0,'#16345c'], [.53,'#214c82'], [1,'#3475af']]));
    ctx.strokeStyle = '#94bce328';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(513, 261, 150 + i * 16, 101 + i * 12, -.68, 0, tau);
      ctx.stroke();
    }
    barsLogo(ctx, 203, 49, 92, '#ebf6ff');
    text(ctx, 'Auditoria', 248, 184, 38, '#ffffff', 620, 'center');
    text(ctx, 'CONTROLES INTERNOS', 248, 210, 15, '#b4d7ed', 640, 'center');
    rect(ctx, 218, 232, 60, 2, '#72c7de');
  }
  function office(ctx) {
    rect(ctx, 0, 0, 496, 144, gradient(ctx, 0, 140, 480, 0, [[0,'#d5c4b3'], [.38,'#ebe3d5'], [1,'#f6efe2']]));
    rect(ctx, 17, 23, 5, 98, '#a36b38');
    rect(ctx, 17, 22, 3, 98, '#ecad59');
    ctx.save();
    ctx.shadowColor = '#513f3a6b';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 3;
    barsLogo(ctx, 48, 34, 70, '#2b4966');
    text(ctx, 'Auditoria', 145, 83, 55, '#243f59', 680);
    text(ctx, 'e Controles Internos', 147, 113, 24, '#354c61', 590);
    ctx.restore();
  }
  function distribution(ctx) {
    rect(ctx, 0, 0, 760, 280, gradient(ctx, 0, 280, 760, 0, [[0,'#183356'], [.55,'#294974'], [1,'#365880']]));
    rect(ctx, 0, 0, 760, 3, '#66809c');
    rect(ctx, 0, 259, 760, 21, '#ef9e35');
    rect(ctx, 0, 259, 760, 2, '#ffd783');
    ctx.save();
    ctx.shadowColor = '#0d2448';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 4;
    cubeLogo(ctx, 109, 130, 125, ['#ffcb6b','#ffb842','#df9029']);
    text(ctx, 'Centro de', 203, 105, 60, '#faf8ed', 670);
    text(ctx, 'Distribuição', 201, 175, 67, '#faf8ed', 670);
    ctx.restore();
    text(ctx, 'AURORA DISTRIBUIÇÃO S.A.', 207, 216, 18, '#b9cce0', 650);
  }
  function carton(ctx) {
    rect(ctx, 0, 0, 272, 136, '#f1eee5');
    rect(ctx, 0, 0, 272, 25, '#27384b');
    text(ctx, 'AURORA  /  LOGÍSTICA', 10, 18, 14, '#ffffff', 680);
    text(ctx, 'VOLUME', 12, 42, 10, '#56616c', 700);
    text(ctx, 'AD • 001', 11, 65, 21, '#253242', 710);
    rect(ctx, 123, 32, 1, 34, '#9d9a8b');
    text(ctx, 'DESTINO', 133, 42, 10, '#56616c', 700);
    text(ctx, 'Estoque', 133, 63, 18, '#253242', 630);
    rect(ctx, 12, 73, 248, 1, '#a4a396');
    // Code 39 printed bars for the pack label, *AD001* including start and end.
    const code = ['nwnnwnwnn','wnnnnwnnw','nnnnwwnnw','nnnwwnwnn','nnnwwnwnn','wnnwnnnnw','nwnnwnwnn'];
    let x = 13;
    code.forEach(pattern => {
      [...pattern].forEach((bar, index) => {
        const module = bar === 'w' ? 3 : 1.4;
        if (!(index % 2)) rect(ctx, x, 82, module, 31, '#24292d');
        x += module;
      });
      x += 1.4;
    });
    text(ctx, 'A D 0 0 1', 14, 128, 11, '#282b2d', 640);
    [223,243].forEach(center => {
      polygon(ctx, [[center,84],[center-6,92],[center+6,92]], '#333739');
      rect(ctx, center-2, 91, 4, 19, '#333739');
    });
    rect(ctx, 215, 113, 37, 3, '#333739');
  }
  function aisle(ctx, letter) {
    rect(ctx, 0, 0, 140, 140, '#20395b');
    panel(ctx, 3, 3, 134, 134, 5, gradient(ctx, 0, 140, 140, 0, [[0,'#23466e'], [1,'#415f96']]), '#e2e9ee');
    circle(ctx, 12, 12, 2.5, '#c2cfda');
    circle(ctx, 128, 12, 2.5, '#c2cfda');
    text(ctx, 'CORREDOR', 70, 29, 12, '#bcd4ec', 650, 'center');
    text(ctx, letter, 70, 116, 96, '#fffdf4', 670, 'center');
  }
  function documentSurface(ctx) {
    rect(ctx, 0, 0, 400, 560, '#f7f4eb');
    rect(ctx, 0, 0, 400, 8, '#233c59');
    cubeLogo(ctx, 54, 63, 43, ['#4d7a99','#24506f','#d39b4e']);
    text(ctx, 'Aurora Distribuição S.A.', 90, 63, 22, '#294459', 650);
    text(ctx, 'CONTROLE DE MERCADORIAS', 91, 81, 10, '#596a72', 660);
    rect(ctx, 33, 111, 334, 1, '#a5afb3');
    text(ctx, 'Registro de entrada', 32, 160, 31, '#203b54', 640);
    text(ctx, 'Recebimento e conferência', 33, 186, 17, '#566672');
    ['Data', 'Documento de origem', 'Responsável'].forEach((item, i) => {
      const y = 229 + i * 34;
      text(ctx, item, 34, y, 13, '#485f6c', 560);
      rect(ctx, 180, y + 1, 184, 1, '#aeb8b9');
    });
    rect(ctx, 33, 326, 334, 33, '#32536c');
    text(ctx, 'Item / descrição', 42, 348, 14, '#f2f5f5', 640);
    text(ctx, 'Un.', 258, 348, 14, '#f2f5f5', 640);
    text(ctx, 'Qtde.', 310, 348, 14, '#f2f5f5', 640);
    for (let i = 0; i < 5; i++) {
      const y = 360 + i * 24;
      if (!(i % 2)) rect(ctx, 33, y, 334, 24, '#e9eae2');
      rect(ctx, 33, y+23, 334, 1, '#c1c9c9');
    }
    [245,295].forEach(x => rect(ctx, x, 359, 1, 120, '#c3cbca'));
    rect(ctx, 33, 504, 334, 1, '#8194a0');
    text(ctx, 'AURORA  /  OPERAÇÕES', 34, 528, 11, '#596b75', 660);
    text(ctx, '01', 366, 528, 12, '#596b75', 660, 'right');
  }

  function paint(canvas, key, painter) {
    const ctx = canvas.getContext('2d');
    const [x, y, w, h] = tiles[key];
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    painter(ctx);
    ctx.restore();
    // Extend edge texels into the gutter before the graphics card builds mipmaps.
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    const pad = 4;
    ctx.drawImage(canvas, x, y, w, 1, x, y-pad, w, pad);
    ctx.drawImage(canvas, x, y+h-1, w, 1, x, y+h, w, pad);
    ctx.drawImage(canvas, x, y-pad, 1, h+pad*2, x-pad, y-pad, pad, h+pad*2);
    ctx.drawImage(canvas, x+w-1, y-pad, 1, h+pad*2, x+w, y-pad, pad, h+pad*2);
    ctx.restore();
  }

  function createAtlas() {
    if (atlas) return atlas;
    atlas = document.createElement('canvas');
    atlas.width = width;
    atlas.height = height;
    Object.entries({dashboard, workstation, office, distribution, carton, document: documentSurface})
      .forEach(([key, painter]) => paint(atlas, key, painter));
    for (const letter of ['A', 'B', 'C']) paint(atlas, 'aisle' + letter, ctx => aisle(ctx, letter));
    paint(atlas, 'window', ctx => {
      rect(ctx, 0, 0, 1536, 576, gradient(ctx, 0, 0, 0, 576, [[0,'#67b4e8'], [.73,'#d9ebf0'], [1,'#86ad95']]));
    });
    ready = new Promise(resolve => {
      if (!global.SCAIHorizonte) { resolve(atlas); return; }
      const picture = new Image();
      picture.onload = () => {
        paint(atlas, 'window', ctx => ctx.drawImage(picture, 0, 0, 1536, 576));
        resolve(atlas);
      };
      picture.onerror = () => resolve(atlas);
      picture.src = global.SCAIHorizonte;
    });
    return atlas;
  }
  function uv(key) {
    const [x, y, w, h] = tiles[key];
    return [(x+.5)/width, (y+.5)/height, (x+w-.5)/width, (y+h-.5)/height];
  }
  function createPanorama() {
    createAtlas();
    const [x,y,w,h]=tiles.window,canvas=document.createElement('canvas');
    canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(atlas,x,y,w,h,0,0,w,h);
    return canvas;
  }
  global.SCAIGraphics = {
    createAtlas, createPanorama, uv,
    get ready() { createAtlas(); return ready; }
  };
})(window);
