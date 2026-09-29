'use strict';

/* ============================================================================
 * 1. PARÂMETROS DO MODELO
 * ----------------------------------------------------------------------------
 * Todos os números que definem o comportamento da simulação estão aqui.
 * São hipóteses didáticas, não valores biológicos calibrados.
 *
 * Dois tipos de parâmetro:
 *  - FIXOS: constantes da grade e do cenário padrão (não mudam na tela);
 *  - EDITÁVEIS: lista PARAMETROS, que gera automaticamente os campos do
 *    painel "Parâmetros do modelo". Para criar um novo parâmetro editável,
 *    basta acrescentar um item na lista e usá-lo no motor (sim.params.<id>).
 * ========================================================================== */

/* ------------------------------- Fixos ------------------------------- */

/** Lado da grade quadrada (30 × 30 = 900 posições). */
const GRID_SIZE = 30;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

/**
 * Máximo de formigas numa mesma posição, contando TODOS os estados
 * (saudável, infectada, morta ou produtora). Com 1, cada posição está
 * vazia ou tem exatamente uma formiga.
 */
const CELL_CAPACITY = 1;

/** Semente fixa: garante que o cenário padrão seja sempre o mesmo. */
const DEFAULT_SEED = 23092026;

/** Cenário padrão (botão "Cenário padrão"). */
const SCENARIO = {
  healthy: 100,     // saudáveis, cada uma numa posição diferente, em toda a grade
  producers: 1,     // produtoras de esporos
  centerIndex: 15 * GRID_SIZE + 15, // a 1ª produtora fica no centro: linha 16, coluna 16
};

/* ----------------------------- Editáveis ----------------------------- */

/**
 * Cada item vira um campo na tela, dentro do seu grupo.
 *   id      — nome usado no código: sim.params.<id>
 *   group   — título do grupo no painel
 *   label   — texto mostrado no painel (curto, para caber numa linha)
 *   unit    — unidade mostrada dentro do campo
 *   min/max — limites aceitos
 *   step    — incremento do campo (0.1 permite porcentagens como 2,5%)
 *   value   — valor padrão
 *
 * As chances ficam em PORCENTAGEM (0 a 100). O motor divide por 100 na hora
 * do sorteio: this.random() < chance / 100.
 */
const PARAMETROS = [
  // Chance de infecção: por geração, para cada saudável com produtora vizinha.
  { id: 'infectionChance',  group: 'Chances', label: 'Infecção',             unit: '%',        min: 0, max: 100, step: 0.1, value: 10 },
  { id: 'moveChance',       group: 'Chances', label: 'Movimento',            unit: '%',        min: 0, max: 100, step: 0.1, value: 0 },
  { id: 'producerChance',   group: 'Chances', label: 'Morta vira produtora', unit: '%',        min: 0, max: 100, step: 0.1, value: 50 },
  { id: 'infectedDeathAge', group: 'Tempos',  label: 'Infectada morre em',   unit: 'gerações', min: 1, max: 200, step: 1,   value: 10 },
  { id: 'maturationAge',    group: 'Tempos',  label: 'Morta amadurece em',   unit: 'gerações', min: 1, max: 200, step: 1,   value: 5 },
  { id: 'sporeDuration',    group: 'Tempos',  label: 'Esporos duram',        unit: 'gerações', min: 1, max: 200, step: 1,   value: 20 },
];

/** Objeto { id: valorPadrão } montado a partir da lista acima. */
function defaultParams() {
  return Object.fromEntries(PARAMETROS.map(p => [p.id, p.value]));
}
