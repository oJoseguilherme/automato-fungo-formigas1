'use strict';

/* ============================================================================
 * 2. CÉLULA E GRADE
 * ----------------------------------------------------------------------------
 * Funções pequenas de apoio: criar uma célula, copiar a grade, converter
 * coordenadas e listar vizinhos. Todas as posições são equivalentes
 * (não há terreno nem formigueiro).
 * ========================================================================== */

/**
 * Cria uma célula vazia. Uma célula é um ESTADO COMPOSTO: guarda quantas formigas
 * existem em cada estado e, para os estados com temporizador, a idade de cada uma.
 *
 * @returns {{healthy:number, infected:number[], corpses:number[], producers:number[]}}
 *   healthy   — contagem de saudáveis (não precisam de idade)
 *   infected  — idade (em gerações) de cada infectada
 *   corpses   — idade de cada cadáver ainda sem produzir (amadurecendo)
 *   producers — idade (em gerações de produção) de cada cadáver produtor de esporos
 */
function createCell() {
  return { healthy: 0, infected: [], corpses: [], producers: [] };
}

/** Quantas formigas (em qualquer estado) há na célula. */
function occupancy(cell) {
  return cell.healthy + cell.infected.length + cell.corpses.length + cell.producers.length;
}

/** Cópia profunda e independente de uma grade (usada para salvar/restaurar o cenário). */
function cloneCells(cells) {
  return JSON.parse(JSON.stringify(cells));
}

/** Converte coordenadas (coluna x, linha y), contadas do zero, em índice linear. */
function toIndex(x, y) {
  return y * GRID_SIZE + x;
}

/** Converte índice linear em { x: coluna, y: linha }, contadas do zero. */
function toXY(k) {
  return { x: k % GRID_SIZE, y: Math.floor(k / GRID_SIZE) };
}

function isInsideGrid(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

/**
 * Retângulo entre duas posições (em qualquer ordem de canto):
 * { x0, y0, x1, y1 }, com x0 ≤ x1 e y0 ≤ y1.
 */
function rectBetween(a, b) {
  const p = toXY(a);
  const q = toXY(b);
  return { x0: Math.min(p.x, q.x), y0: Math.min(p.y, q.y), x1: Math.max(p.x, q.x), y1: Math.max(p.y, q.y) };
}

/**
 * Vizinhança de Moore (8 vizinhos), como deslocamentos [dx, dy].
 * A ORDEM importa: o transporte usa DIRECTIONS[geração % 8], então a sequência
 * de direções ao longo das gerações é ↓ → ↑ ← ↘ ↖ ↗ ↙ (dx = coluna, dy = linha;
 * y cresce para baixo, então [0, 1] é "uma linha para baixo").
 */
const DIRECTIONS = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];

/** Índices dos vizinhos de Moore que existem (bordas têm menos de 8). */
function neighbors(k) {
  const { x, y } = toXY(k);
  return DIRECTIONS
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => isInsideGrid(a, b))
    .map(([a, b]) => toIndex(a, b));
}
