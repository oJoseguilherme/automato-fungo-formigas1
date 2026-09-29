'use strict';

/* ============================================================================
 * 5. EDITORES: CENÁRIO INICIAL E PARÂMETROS DO MODELO
 * ----------------------------------------------------------------------------
 * Tudo aqui só funciona na geração 0 e com a simulação parada. Depois de
 * iniciar, é preciso clicar em Reiniciar para editar de novo.
 * ========================================================================== */

/** A edição só é permitida na geração 0 e com a simulação parada. */
function canEdit() {
  return sim.generation === 0 && timer === null;
}

/* ------------------------ Parâmetros do modelo ------------------------ */

/**
 * Cria um campo para cada item de PARAMETROS (1-parametros.js), separados
 * pelos grupos (Chances, Tempos). Cada campo tem id "param-<id>".
 */
function buildParamFields() {
  const groups = [...new Set(PARAMETROS.map(p => p.group))];
  $('params').innerHTML = groups.map(group => `
    <div class="param-group">
      <div class="param-group-title">${group}</div>
      ${PARAMETROS.filter(p => p.group === group).map(p => `
        <label class="param-field">
          <span class="param-label">${p.label}</span>
          <span class="param-input">
            <input id="param-${p.id}" type="number" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
            <span class="param-unit">${p.unit}</span>
          </span>
        </label>`).join('')}
    </div>`).join('');

  for (const p of PARAMETROS) {
    const input = $(`param-${p.id}`);
    input.onchange = () => {
      try {
        sim.setParam(p.id, Number(input.value));
      } catch (error) {
        // Valor inválido ou fora da geração 0: volta ao valor atual do motor.
      }
      render();
    };
  }
}

/** Copia os valores do motor para os campos (ex.: depois de "Cenário padrão"). */
function syncParamFields() {
  for (const p of PARAMETROS) $(`param-${p.id}`).value = sim.params[p.id];
}

/* --------------------------- Cenário inicial --------------------------- */

/** Atualiza selos, campos habilitados, notas e cursor do canvas. */
function updateEditor() {
  const editable = canEdit();

  for (const badge of ['editor-badge', 'params-badge']) {
    $(badge).textContent = editable ? 'Editável' : 'Bloqueado';
    $(badge).classList.toggle('locked', !editable);
  }

  const ids = ['edit-mode', 'fill-grid', ...PARAMETROS.map(p => `param-${p.id}`)];
  for (const id of ids) $(id).disabled = !editable;
  syncParamFields();

  // Com a edição bloqueada, uma linha lembra como liberá-la.
  for (const note of ['editor-note', 'params-note']) {
    $(note).hidden = editable;
    $(note).textContent = 'Clique em Reiniciar para editar.';
  }

  const editing = editable && $('editor').open;
  canvas.style.cursor = editing ? 'crosshair' : 'pointer';
  canvas.style.touchAction = editing ? 'none' : 'auto'; // no celular, arrastar edita em vez de rolar a página
}

/**
 * Aplica a ação do editor no retângulo entre as posições from e to
 * (por padrão, só na posição selecionada).
 * Edições inválidas são ignoradas em silêncio: o motor lança o erro e a grade não muda.
 */
function applyEdit(from = selection, to = from) {
  if (!canEdit()) return;
  try {
    sim.editArea(from, to, $('edit-mode').value);
  } catch (error) {
    // Intencionalmente silencioso.
  }
  render();
}

/** Aplica a ação do editor na grade inteira. */
function applyFillGrid() {
  if (!canEdit()) return;
  sim.fillGrid($('edit-mode').value);
  render();
}
