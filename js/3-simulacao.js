'use strict';

/* ============================================================================
 * 3. MOTOR DA SIMULAÇÃO
 * ----------------------------------------------------------------------------
 * Não lê nem escreve nada na tela. Toda a interface consulta este objeto.
 *
 * Cada chamada de step() avança UMA geração em duas etapas:
 *   1) biologicalPhase — contágio, envelhecimento, mortes, maturação,
 *      produção de esporos e remoção de cadáveres;
 *   2) transportPhase  — deslocamento de vivas para uma célula vizinha.
 * As duas etapas leem a grade "antiga" e escrevem numa grade nova, de modo
 * que a ordem de varredura das células não altera as regras (atualização simultânea).
 *
 * Os valores editáveis ficam em this.params (ver 1-parametros.js).
 *
 * IMPORTANTE para reprodutibilidade: a ordem das chamadas a random() faz parte
 * do comportamento. Mudar a ordem dos laços muda os resultados de cada semente.
 * ========================================================================== */
class Simulation {
  constructor() {
    /** Cópia salva do cenário inicial (null = gerar o cenário padrão). */
    this.initialCells = null;
    /** Parâmetros editáveis na geração 0 (chances em %, tempos em gerações). */
    this.params = defaultParams();
    this.reset();
  }

  /* -------------------------- Aleatoriedade -------------------------- */

  /**
   * Gerador congruencial linear (LCG) de 32 bits:
   *   seed ← (1664525 · seed + 1013904223) mod 2³²
   * Retorna um número em [0, 1). Com a mesma semente, a sequência é sempre igual.
   */
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Sorteio com chance em porcentagem: chance(12) é verdadeiro em ~12% das vezes. */
  chance(percent) {
    return this.random() < percent / 100;
  }

  /** Embaralhamento de Fisher–Yates (Durstenfeld), in-place, usando o LCG. */
  shuffle(list) {
    for (let j = list.length - 1; j > 0; j--) {
      const p = Math.floor(this.random() * (j + 1));
      [list[j], list[p]] = [list[p], list[j]];
    }
  }

  /* ------------------------ Cenário e reinício ------------------------ */

  /**
   * Volta à geração 0: zera contadores e restaura o cenário salvo
   * (ou gera o cenário padrão, se nenhum foi salvo ainda).
   * Não altera os parâmetros.
   */
  reset() {
    this.seed = DEFAULT_SEED;
    this.generation = 0;
    this.deaths = 0;      // mortes acumuladas desde a geração 0
    this.infections = 0;  // infecções acumuladas
    this.matured = 0;     // mortas que viraram produtoras
    this.removed = 0;     // cadáveres removidos
    this.lastDeaths = 0;

    if (this.initialCells) {
      this.cells = cloneCells(this.initialCells);
      this.seed = this.initialSeed; // mesma sequência de sorteios a cada Reiniciar
      return;
    }
    this.buildDefaultScenario();
    this.saveInitial();
  }

  /**
   * Cenário padrão (semente 23092026, sempre o mesmo):
   *  - a 1ª produtora de esporos fica no centro (linha 16, coluna 16);
   *  - as demais produtoras e as saudáveis ocupam posições DIFERENTES,
   *    sorteadas em toda a grade (uma formiga por posição).
   */
  buildDefaultScenario() {
    this.cells = Array.from({ length: CELL_COUNT }, () => createCell());
    let producers = SCENARIO.producers;
    if (producers > 0) {
      this.cells[SCENARIO.centerIndex].producers = [0];
      producers--;
    }

    // Lista as posições livres, embaralha e ocupa as primeiras.
    const free = [];
    for (let k = 0; k < CELL_COUNT; k++) {
      if (occupancy(this.cells[k]) < CELL_CAPACITY) free.push(k);
    }
    this.shuffle(free);
    free.slice(0, producers).forEach(k => { this.cells[k].producers = [0]; });
    free.slice(producers, producers + SCENARIO.healthy).forEach(k => { this.cells[k].healthy = 1; });
  }

  /** Salva uma cópia independente do cenário atual; Reiniciar volta a ela. */
  saveInitial() {
    this.initialCells = cloneCells(this.cells);
    this.initialSeed = this.seed;
    const t = this.totals();
    this.initialLiving = t.healthy + t.infected;
    this.initialCadavers = t.corpses + t.producers;
  }

  /**
   * Substitui o conteúdo de TODAS as posições do retângulo entre a e b
   * (só na geração 0) por UMA formiga no estado escolhido, ou as esvazia.
   * Um clique simples é o retângulo de uma posição só (a = b).
   * @param {number} a, b   Índices dos cantos opostos (0..899).
   * @param {string} mode   'healthy' | 'infected' | 'dead' | 'producer' | 'empty'.
   * @throws {Error} quando a edição não é válida.
   */
  editArea(a, b, mode) {
    if (this.generation !== 0) throw new Error('Reinicie para editar o cenário inicial.');
    for (const k of [a, b]) {
      if (!Number.isInteger(k) || k < 0 || k >= CELL_COUNT) throw new Error('Selecione uma posição da grade.');
    }
    if (!['healthy', 'infected', 'dead', 'producer', 'empty'].includes(mode)) throw new Error('Escolha uma ação de edição.');

    const { x0, y0, x1, y1 } = rectBetween(a, b);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cell = createCell();
        if (mode === 'healthy') cell.healthy = 1;
        else if (mode === 'infected') cell.infected = [0];
        else if (mode === 'dead') cell.corpses = [0];
        else if (mode === 'producer') cell.producers = [0];
        this.cells[toIndex(x, y)] = cell;
      }
    }
    this.saveInitial();
  }

  /** Aplica o estado escolhido à grade inteira (30 × 30). */
  fillGrid(mode) {
    this.editArea(0, CELL_COUNT - 1, mode);
  }

  /** Altera um parâmetro editável (só na geração 0), validando os limites. */
  setParam(id, value) {
    if (this.generation !== 0) throw new Error('Reinicie para alterar os parâmetros.');
    const def = PARAMETROS.find(p => p.id === id);
    if (!def) throw new Error('Parâmetro desconhecido.');
    if (!Number.isFinite(value) || value < def.min || value > def.max) throw new Error('Valor fora dos limites.');
    if (def.step === 1 && !Number.isInteger(value)) throw new Error('Use um número inteiro.');
    this.params[id] = value;
  }

  /** Descarta o cenário editado e os parâmetros, voltando ao padrão. */
  restoreDefault() {
    this.initialCells = null;
    this.params = defaultParams();
    this.reset();
  }

  /** Soma de cada estado em toda a grade. */
  totals() {
    return this.cells.reduce((acc, cell) => {
      acc.healthy += cell.healthy;
      acc.infected += cell.infected.length;
      acc.corpses += cell.corpses.length;
      acc.producers += cell.producers.length;
      return acc;
    }, { healthy: 0, infected: 0, corpses: 0, producers: 0 });
  }

  /* -------------------------- Uma geração -------------------------- */

  /** Avança uma geração: etapa biológica e transporte. */
  step() {
    const deathsBefore = this.deaths;
    const afterBiology = this.biologicalPhase(this.cells);
    this.cells = this.transportPhase(afterBiology);
    this.generation++;
    this.lastDeaths = this.deaths - deathsBefore;
  }

  /**
   * ETAPA 1 — Processos biológicos. Lê `old` e devolve uma grade nova.
   * Estados criados aqui (ex.: nova infectada com idade 0) só evoluem
   * na próxima geração.
   */
  biologicalPhase(old) {
    return old.map((cell, k) => this.updateCellBiology(cell, k, old));
  }

  /** Aplica, a uma única célula, as regras biológicas na ordem abaixo. */
  updateCellBiology(cell, k, old) {
    const p = this.params;
    const out = createCell();

    // (a) Exposição: há produtora na própria posição ou em algum dos 8 vizinhos?
    //     Uma ou várias produtoras dão a mesma chance (não há dose de esporos).
    const exposed = cell.producers.length > 0 || neighbors(k).some(j => old[j].producers.length > 0);

    // (b) Contágio: cada saudável exposta vira infectada (idade 0) com
    //     chance infectionChance %. Sem exposição, nenhum sorteio é feito.
    for (let n = 0; n < cell.healthy; n++) {
      if (exposed && this.chance(p.infectionChance)) {
        out.infected.push(0);
        this.infections++;
      } else {
        out.healthy++;
      }
    }

    // (c) Infectadas envelhecem 1 geração e morrem ao atingir infectedDeathAge,
    //     virando cadáver (idade 0).
    for (const age of cell.infected) {
      const newAge = age + 1;
      if (newAge >= p.infectedDeathAge) {
        out.corpses.push(0);
        this.deaths++;
      } else {
        out.infected.push(newAge);
      }
    }

    // (d) MATURAÇÃO: cadáveres envelhecem. Ao atingir maturationAge, há um
    //     sorteio com chance producerChance %:
    //       - sucesso → vira produtora de esporos (idade de produção 0);
    //       - falha   → é removido (decompõe sem produzir).
    //     Antes disso, continua amadurecendo.
    for (const age of cell.corpses) {
      const newAge = age + 1;
      if (newAge < p.maturationAge) {
        out.corpses.push(newAge);
      } else if (this.chance(p.producerChance)) {
        out.producers.push(0);
        this.matured++;
      } else {
        this.removed++;
      }
    }

    // (e) Produtoras envelhecem e são removidas ao completar sporeDuration gerações.
    for (const age of cell.producers) {
      if (age + 1 >= p.sporeDuration) this.removed++;
      else out.producers.push(age + 1);
    }

    // Nenhuma regra desta etapa cria formigas: cada uma só muda de estado ou
    // é removida. Por isso a célula nunca passa de CELL_CAPACITY aqui.
    return out;
  }

  /**
   * ETAPA 2 — Transporte. Em cada geração TODAS as células tentam enviar formigas
   * na MESMA direção (DIRECTIONS[geração % 8]). Com isso cada destino tem uma
   * única origem, o que evita disputa por vagas e conserva a população.
   * A vaga do destino é medida antes de qualquer transferência (grade `next`),
   * então saídas nesta mesma etapa não liberam espaço extra.
   * Mortas e produtoras não se movem, mas OCUPAM a posição: uma formiga viva
   * não entra numa posição que tenha um cadáver.
   */
  transportPhase(next) {
    // Só o array de infectadas é copiado, porque é o único alterado aqui
    // (cadáveres e produtoras não se movem).
    const moved = next.map(cell => ({ ...cell, infected: [...cell.infected] }));
    const [dx, dy] = DIRECTIONS[this.generation % DIRECTIONS.length];
    next.forEach((cell, k) => this.transportFromCell(cell, k, next, moved, dx, dy));
    return moved;
  }

  /** Move formigas vivas da célula k para a vizinha na direção (dx, dy). */
  transportFromCell(cell, k, next, moved, dx, dy) {
    const { x, y } = toXY(k);
    const destX = x + dx;
    const destY = y + dy;
    if (!isInsideGrid(destX, destY)) return;      // borda: movimento bloqueado

    const dest = toIndex(destX, destY);
    const free = CELL_CAPACITY - occupancy(next[dest]);
    if (free <= 0) return;                         // destino ocupado: bloqueado

    // Cada viva decide mover-se com chance moveChance %. Saudáveis primeiro,
    // depois infectadas (guardando idade e posição original para removê-las depois).
    const candidates = [];
    for (let n = 0; n < cell.healthy; n++) {
      if (this.chance(this.params.moveChance)) candidates.push({ healthy: true });
    }
    cell.infected.forEach((age, index) => {
      if (this.chance(this.params.moveChance)) candidates.push({ healthy: false, age, index });
    });

    // Embaralha para que nenhum estado tenha prioridade quando faltam vagas.
    this.shuffle(candidates);
    const accepted = candidates.slice(0, free);

    let leavingHealthy = 0;
    const leavingInfected = new Set();
    for (const ant of accepted) {
      if (ant.healthy) {
        leavingHealthy++;
      } else {
        leavingInfected.add(ant.index);
        moved[dest].infected.push(ant.age); // a infectada leva a própria idade
      }
    }

    moved[k].healthy -= leavingHealthy;
    moved[dest].healthy += leavingHealthy;
    // Chegadas de outra célula foram adicionadas no FIM do array, então os
    // índices originais (0..n-1) continuam válidos.
    moved[k].infected = moved[k].infected.filter((_, index) => !leavingInfected.has(index));
  }
}
