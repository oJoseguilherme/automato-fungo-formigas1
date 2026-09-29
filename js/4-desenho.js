'use strict';

/* ============================================================================
 * 4. DESENHO DA GRADE E DOS PAINÉIS
 * ----------------------------------------------------------------------------
 * Apenas LÊ o estado do motor. Nenhuma função daqui altera a biologia.
 * ========================================================================== */

/** A simulação (única instância, usada por todos os arquivos seguintes). */
const sim = new Simulation();

/** Atalho para buscar elementos da página pelo id. */
const $ = id => document.getElementById(id);
const canvas = $('grid');
const ctx = canvas.getContext('2d');

/** Estado da interface. */
let timer = null;      // id do setInterval enquanto está em execução; null = pausada
let selection = null;  // índice da posição selecionada, ou null
let dragArea = null;   // retângulo sendo arrastado no editor: { from, to }, ou null

/** Cores do canvas — mesmos valores das variáveis CSS --empty, --healthy etc. */
const CELL_COLORS = {
  empty: '#efece5',
  healthy: '#4f8a5b',
  infected: '#dcae4c',
  dead: '#a8a59c',
  producer: '#694a86',
};

/**
 * Geometria do canvas (pixels internos, não de tela):
 * 960 = 37 de margem (rótulos) + 30 × 30 px de células + 23 de sobra.
 */
const CANVAS_SIZE = 960;
const GRID_MARGIN = 37;
const CELL_PX = 30;
const CELL_GAP = 2.5;     // espaço entre células
const CELL_RADIUS = 5;    // canto arredondado de cada célula

/** Número no formato brasileiro (vírgula decimal). */
function formatNumber(n) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}

/**
 * Uma cor por posição, pela prioridade:
 * produtora > infectada > saudável > morta > vazia.
 */
function cellColor(cell) {
  if (cell.producers.length) return CELL_COLORS.producer;
  if (cell.infected.length) return CELL_COLORS.infected;
  if (cell.healthy) return CELL_COLORS.healthy;
  if (cell.corpses.length) return CELL_COLORS.dead;
  return CELL_COLORS.empty;
}

/** Desenha um retângulo de cantos arredondados (apenas o caminho). */
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Canvas: fundo, células, contorno da seleção e rótulos 1..30. */
function renderGrid() {
  ctx.fillStyle = '#fffdf9';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  sim.cells.forEach((cell, k) => {
    const { x, y } = toXY(k);
    ctx.fillStyle = cellColor(cell);
    roundRect(
      GRID_MARGIN + x * CELL_PX + CELL_GAP / 2,
      GRID_MARGIN + y * CELL_PX + CELL_GAP / 2,
      CELL_PX - CELL_GAP, CELL_PX - CELL_GAP, CELL_RADIUS);
    ctx.fill();
  });

  if (dragArea) renderDragArea();

  if (selection !== null && !dragArea) {
    const { x, y } = toXY(selection);
    ctx.strokeStyle = '#23262b';
    ctx.lineWidth = 2.5;
    roundRect(GRID_MARGIN + x * CELL_PX - 1, GRID_MARGIN + y * CELL_PX - 1, CELL_PX + 2, CELL_PX + 2, 7);
    ctx.stroke();
  }

  // Rótulos de linha e coluna; 1 e múltiplos de 5 ficam mais escuros.
  ctx.font = '500 12px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < GRID_SIZE; i++) {
    const major = (i + 1) % 5 === 0 || i === 0;
    ctx.fillStyle = major ? '#5b5f66' : '#b3b0a7';
    const center = GRID_MARGIN + i * CELL_PX + CELL_PX / 2;
    ctx.fillText(i + 1, center, 20); // colunas (topo)
    ctx.fillText(i + 1, 18, center); // linhas (esquerda)
  }
}

/** Cor de prévia de cada ação do editor. */
const MODE_COLORS = {
  empty: CELL_COLORS.empty,
  healthy: CELL_COLORS.healthy,
  infected: CELL_COLORS.infected,
  dead: CELL_COLORS.dead,
  producer: CELL_COLORS.producer,
};

/** Prévia do retângulo arrastado: cor da ação escolhida e contorno. */
function renderDragArea() {
  const { x0, y0, x1, y1 } = rectBetween(dragArea.from, dragArea.to);
  const left = GRID_MARGIN + x0 * CELL_PX;
  const top = GRID_MARGIN + y0 * CELL_PX;
  const width = (x1 - x0 + 1) * CELL_PX;
  const height = (y1 - y0 + 1) * CELL_PX;

  ctx.globalAlpha = 0.55;
  ctx.fillStyle = MODE_COLORS[$('edit-mode').value];
  roundRect(left, top, width, height, 7);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#23262b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Tamanho da seleção, ex.: "5 × 3".
  ctx.font = '600 14px system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#23262b';
  ctx.fillText(`${x1 - x0 + 1} × ${y1 - y0 + 1}`, left, Math.max(14, top - 4));
}

/** Linha de status acima da grade. */
function renderStatus(t) {
  const noActiveInfection = !t.infected && !t.corpses && !t.producers;
  $('status').textContent =
    `Geração ${sim.generation} · ${timer ? 'Em execução' : 'Pausada'}${noActiveInfection ? ' · Sem infecção ativa' : ''}`;
  $('status').classList.toggle('running', timer !== null);
}

/** Um bloco de contagem do painel "População". */
function statBlock(label, color, value) {
  return `<div class="stat"><span class="k"><i style="background:var(${color})"></i>${label}</span><div class="v">${value}</div></div>`;
}

/** Painel "População": vivas, estados atuais e acumulados. */
function renderTotals(t) {
  $('totals').innerHTML = [
    '<div class="stats">',
    `<div class="stat wide"><span class="k">Vivas na grade</span><span class="v">${t.healthy + t.infected}</span></div>`,
    statBlock('Saudáveis', '--healthy', t.healthy),
    statBlock('Infectadas', '--infected', t.infected),
    statBlock('Mortas sem produção', '--dead', t.corpses),
    statBlock('Produtoras ativas', '--producer', t.producers),
    '</div>',
    '<div class="rows">',
    `<p>Infecções acumuladas <b>${sim.infections}</b></p>`,
    `<p>Mortes acumuladas <b>${sim.deaths}</b></p>`,
    `<p>Mortas que viraram produtoras <b>${sim.matured}</b></p>`,
    `<p>Mortes na última geração <b>${sim.lastDeaths}</b></p>`,
    '</div>',
  ].join('');
}

/** Botões Iniciar/Pausar/Próxima geração conforme a simulação roda ou não. */
function renderButtons() {
  $('start').disabled = timer !== null;
  $('pause').disabled = timer === null;
  $('step').disabled = timer !== null;
}

/** Redesenha tudo a partir do estado atual do motor. */
function render() {
  renderGrid();
  const t = sim.totals();
  renderStatus(t);
  renderTotals(t);
  renderButtons();
  updateEditor(); // definida em 5-editor.js
}
