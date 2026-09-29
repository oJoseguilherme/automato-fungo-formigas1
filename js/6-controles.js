'use strict';

/* ============================================================================
 * 6. CONTROLES DE EXECUÇÃO E EVENTOS
 * ----------------------------------------------------------------------------
 * Liga botões, canvas e teclado às funções dos arquivos anteriores.
 * Este é o último arquivo carregado: ele desenha a tela pela primeira vez.
 * ========================================================================== */

function pause() {
  if (timer !== null) clearInterval(timer);
  timer = null;
  render();
}

function advance() {
  sim.step();
  render();
}

function start() {
  if (timer !== null) return;
  timer = setInterval(advance, Number($('speed').value));
  render();
}

/** Volta a interface ao estado "nada selecionado, ação Esvaziar". */
function clearSelectionUI() {
  selection = null;
  $('edit-mode').value = 'empty';
}

/* ------------------------------ Execução ------------------------------ */

$('start').onclick = start;
$('pause').onclick = pause;
$('step').onclick = advance;
$('reset').onclick = () => {
  pause();
  sim.reset();
  clearSelectionUI();
  render();
};
$('speed').onchange = () => {
  if (timer !== null) { // reinicia o intervalo com a nova velocidade
    pause();
    start();
  }
};

/* ------------------------------- Editor ------------------------------- */

$('edit-mode').onchange = updateEditor;
$('editor').ontoggle = updateEditor;
$('fill-grid').onclick = applyFillGrid;
$('default-scenario').onclick = () => {
  pause();
  sim.restoreDefault();
  clearSelectionUI();
  render();
};

/* ------------------------------- Canvas ------------------------------- */

/**
 * Converte a posição do ponteiro (pixels de tela → pixels internos) em célula.
 * Com clamp = true, um ponteiro fora da grade vira a célula mais próxima
 * (útil ao arrastar até a borda); sem clamp, devolve null fora da grade.
 */
function cellFromEvent(event, clamp = false) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * CANVAS_SIZE / rect.width;
  const py = (event.clientY - rect.top) * CANVAS_SIZE / rect.height;
  let x = Math.floor((px - GRID_MARGIN) / CELL_PX);
  let y = Math.floor((py - GRID_MARGIN) / CELL_PX);
  if (clamp) {
    x = Math.min(GRID_SIZE - 1, Math.max(0, x));
    y = Math.min(GRID_SIZE - 1, Math.max(0, y));
  }
  return isInsideGrid(x, y) ? toIndex(x, y) : null;
}

// Pressionar: seleciona a posição. Com o editor aberto, começa um retângulo.
canvas.onpointerdown = event => {
  const k = cellFromEvent(event);
  if (k === null) return;
  selection = k;
  if (canEdit() && $('editor').open) {
    dragArea = { from: k, to: k };
    canvas.setPointerCapture(event.pointerId); // continua recebendo o arraste fora do canvas
  }
  render();
};

// Arrastar: estica o retângulo até a posição atual (só redesenha a grade).
canvas.onpointermove = event => {
  if (!dragArea) return;
  const k = cellFromEvent(event, true);
  if (k === dragArea.to) return;
  dragArea.to = k;
  selection = k;
  renderGrid();
};

// Soltar: aplica a ação em todas as posições do retângulo.
canvas.onpointerup = () => {
  if (!dragArea) return;
  const { from, to } = dragArea;
  dragArea = null;
  applyEdit(from, to);
};

canvas.onpointercancel = () => {
  dragArea = null;
  render();
};

// Setas movem a seleção; Enter aplica a edição (com o editor aberto).
const ARROW_KEYS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
canvas.onkeydown = event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    if ($('editor').open) applyEdit();
    return;
  }
  const delta = ARROW_KEYS[event.key];
  if (!delta) return;
  event.preventDefault();

  const { x, y } = toXY(selection ?? 0);
  const newX = Math.min(GRID_SIZE - 1, Math.max(0, x + delta[0]));
  const newY = Math.min(GRID_SIZE - 1, Math.max(0, y + delta[1]));
  selection = toIndex(newX, newY);
  render();
};

/* ---------------------------- Inicialização ---------------------------- */

buildParamFields();
render();
