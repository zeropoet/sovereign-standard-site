const ATLAS_STAGE_WIDTH = 1600;
const ATLAS_STAGE_HEIGHT = 900;
const ATLAS_GRID_STEP = 18;
const ATLAS_GRID_MAJOR_STEP = ATLAS_GRID_STEP * 4;
const ATLAS_FIELD = {
  copy: 'Each unit occupies one deterministic coordinate within the attested structure.'
};

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMetric(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'UNAVAILABLE';
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tagName);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, String(value));
  }
  return node;
}

function buildNodeClass(unit, state) {
  const focusUnit = state.hoverUnit ?? state.selectedUnit;
  const activeID = focusUnit?.id;
  const selected = state.selectedUnit?.id === unit.id;
  const active = activeID === unit.id;
  const hovered = state.hoverUnit?.id === unit.id;
  const neighbor = focusUnit && (focusUnit.atlas.neighbors || []).some((entry) => entry.id === unit.id);
  const role = unit.atlas.role?.primary || 'interior';
  const publicState = getPublicStateLabel(state.publicUnitByID?.get(unit.id)).toLowerCase();

  return [
    'atlas-node',
    selected ? 'is-selected' : '',
    active ? 'is-active' : '',
    hovered ? 'is-hovered' : '',
    neighbor ? 'is-neighbor' : '',
    !selected && !neighbor ? 'is-other' : '',
    `state-${publicState}`,
    `role-${role}`
  ].filter(Boolean).join(' ');
}

function summarizeRegion(cluster) {
  if (!cluster) {
    return 'NO ACTIVE REGION';
  }

  const name = String(cluster.name || cluster.id || 'UNNAMED REGION').toUpperCase();
  const role = String(cluster.profile?.dominant_role || 'interior').toUpperCase();
  const cohesion = formatMetric(cluster.profile?.cohesion_score);
  return `${name} / ${role} REGION / COHESION ${cohesion}`;
}

function getPublicStateLabel(record) {
  if (!record) {
    return 'UNAVAILABLE';
  }

  if (record.state === 'claimable' && record.is_partner_reserved) {
    return 'RESERVED';
  }

  if (record.state === 'claimable') {
    return 'SEALED';
  }

  if (record.state === 'claimed' && record.is_partner_reserved) {
    return 'NODE';
  }

  if (record.state === 'claimed') {
    return 'COLLECTED';
  }

  if (record.state === 'node') {
    return 'NODE';
  }

  return record.display_state || record.state || 'UNAVAILABLE';
}

function renderReadout(unit, cluster, publicRecord) {
  if (!unit) {
    return '<p class="muted">NO UNIT SELECTED.</p>';
  }

  const traits = unit.atlas.traits;
  const position = unit.atlas.position;
  const neighbors = unit.atlas.neighbors || [];
  const clusterProfile = cluster?.profile || {};

  const rows = [
    ['UNIT', unit.id],
    ['STATE', String(getPublicStateLabel(publicRecord)).toUpperCase()],
    ['STATE WEIGHT', formatMetric(unit.atlas.state_weight)],
    ['REGION', cluster?.name || cluster?.id || position.cluster_id],
    ['REGION ROLE', String(clusterProfile.dominant_role || 'interior').toUpperCase()],
    ['UNIT ROLE', String(unit.atlas.role?.primary || 'interior').toUpperCase()],
    ['SIGNATURE AXIS', String(clusterProfile.signature_axis || 'field').toUpperCase()],
    ['REGION SIZE', cluster?.size || 0],
    ['SETTLED X', unit.atlas.coordinate?.x ?? 'UNAVAILABLE'],
    ['SETTLED Y', unit.atlas.coordinate?.y ?? 'UNAVAILABLE'],
    ['REGION COHESION', formatMetric(clusterProfile.cohesion_score)],
    ['LOCAL DENSITY', formatMetric(position.density_score)],
    ['BRIDGE SCORE', formatMetric(position.bridge_score)],
    ['FRONTIER SCORE', formatMetric(position.outlier_score)],
    ['STRUCTURAL DISTANCE', formatMetric(traits.canonical_distance)],
    ['INVERSION COUNT', formatMetric(traits.initial_inversion_count)],
    ['LEAD CHANGES', formatMetric(traits.lead_value_changes)],
    ['MEMORY RUNS', formatMetric(traits.memory_run_count)]
  ];

  return `
    <div class="atlas-readout-head">
      <div>
        <p class="atlas-overlay-kicker">ACTIVE UNIT</p>
        <h2 class="atlas-readout-title">UNIT ${escapeHTML(unit.id)}</h2>
        <p class="atlas-readout-subtitle">${escapeHTML(summarizeRegion(cluster))}</p>
      </div>
      <a class="atlas-readout-link" href="standardcontrol.html?unit=${encodeURIComponent(unit.id)}">CONTROL</a>
    </div>
    <div class="atlas-readout-grid">
      ${rows.map(([label, value]) => `
        <div class="atlas-readout-row">
          <span>${escapeHTML(label)}</span>
          <strong>${escapeHTML(value)}</strong>
        </div>
      `).join('')}
    </div>
    <div class="atlas-readout-neighbors">
      ${(neighbors.slice(0, 4)).map((neighbor) => `
        <button type="button" class="atlas-inline-button" data-unit-target="${escapeHTML(neighbor.id)}">
          <span>U${escapeHTML(neighbor.id)}</span>
          <strong>${escapeHTML(formatMetric(neighbor.distance))}</strong>
        </button>
      `).join('')}
    </div>
  `;
}

function regionCenters(state) {
  return state.clusters.map((cluster) => {
    const x = cluster.anchor?.x ?? (ATLAS_STAGE_WIDTH / 2);
    const y = cluster.anchor?.y ?? (ATLAS_STAGE_HEIGHT / 2);
    return {
      id: cluster.id,
      name: cluster.name || cluster.id,
      profile: cluster.profile || {},
      size: cluster.size || 0,
      x,
      y
    };
  }).sort((left, right) => {
    if (left.size !== right.size) {
      return right.size - left.size;
    }
    return left.id.localeCompare(right.id);
  });
}

function bindTargetButtons(state) {
  document.querySelectorAll('[data-unit-target]').forEach((element) => {
    element.addEventListener('click', () => {
      focusUnit(state, Number(element.getAttribute('data-unit-target')));
    });
  });
}

function updateHoverUnit(state, unit) {
  const currentID = state.hoverUnit?.id ?? null;
  const nextID = unit?.id ?? null;

  if (currentID === nextID) {
    return;
  }

  state.hoverUnit = unit || null;
  drawTopology(state);
}

function applyFieldLayout(state) {
  const unitCount = Math.max(state.units.length, 1);
  const densityScale = Math.sqrt(136 / unitCount);
  const baseSize = 14 * densityScale;
  const maxSize = ATLAS_GRID_STEP - 3;
  const minSize = 7;

  state.units.forEach((unit) => {
    const point = unit.atlas.coordinate || { x: ATLAS_STAGE_WIDTH / 2, y: ATLAS_STAGE_HEIGHT / 2 };
    const density = unit.atlas.position.density_score ?? 0;
    const outlier = unit.atlas.position.outlier_score ?? 0;
    const bridge = unit.atlas.position.bridge_score ?? 0;
    const stateWeight = unit.atlas.state_weight ?? 1;
    unit._x = point.x;
    unit._y = point.y;
    unit._stateWeight = stateWeight;
    unit._size = Math.max(
      minSize,
      Math.min(
        maxSize,
        (baseSize + density * 1.8 + outlier * 1.0 + bridge * 0.7) * (0.92 + ((stateWeight - 1) * 0.45))
      )
    );
  });

  document.getElementById('atlas-expression-copy').textContent = ATLAS_FIELD.copy;
}

function drawTopology(state) {
  const svg = state.svg;
  if (!state.topologyLayer) {
    state.topologyLayer = createSvgNode('g', { class: 'atlas-topology-layer' });
    state.gridLayer = createSvgNode('g', { class: 'atlas-grid' });
    state.guideLayer = createSvgNode('g', { class: 'atlas-topology-guides' });
    state.edgeLayer = createSvgNode('g', { class: 'atlas-topology-edges' });
    state.regionLayer = createSvgNode('g', { class: 'atlas-topology-regions' });
    state.nodeLayer = createSvgNode('g', { class: 'atlas-topology-nodes' });
    state.topologyLayer.append(state.gridLayer, state.guideLayer, state.edgeLayer, state.regionLayer, state.nodeLayer);
    svg.append(state.topologyLayer);
  }

  const grid = state.gridLayer;
  const guides = state.guideLayer;
  const edges = state.edgeLayer;
  const regions = state.regionLayer;
  grid.innerHTML = '';
  guides.innerHTML = '';
  edges.innerHTML = '';
  regions.innerHTML = '';

  for (let x = 0; x <= ATLAS_STAGE_WIDTH; x += ATLAS_GRID_STEP) {
    for (let y = 0; y <= ATLAS_STAGE_HEIGHT; y += ATLAS_GRID_STEP) {
      grid.append(createSvgNode('rect', {
        x: x - 0.5,
        y: y - 0.5,
        width: 1,
        height: 1,
        class: 'atlas-grid-point atlas-grid-point-minor'
      }));
    }
  }

  const activeUnit = state.hoverUnit || state.selectedUnit;
  const selectedNeighbors = new Set((activeUnit?.atlas?.neighbors || []).map((neighbor) => neighbor.id));

  if (activeUnit) {
    const activeCenterX = activeUnit._x + (activeUnit._size / 2);
    const activeCenterY = activeUnit._y + (activeUnit._size / 2);

    guides.append(
      createSvgNode('line', {
        x1: activeUnit._x,
        y1: 0,
        x2: activeUnit._x,
        y2: ATLAS_STAGE_HEIGHT,
        class: 'atlas-guide atlas-guide-axis'
      }),
      createSvgNode('line', {
        x1: 0,
        y1: activeUnit._y,
        x2: ATLAS_STAGE_WIDTH,
        y2: activeUnit._y,
        class: 'atlas-guide atlas-guide-axis'
      }),
      createSvgNode('rect', {
        x: activeUnit._x - 8,
        y: activeUnit._y - 8,
        width: activeUnit._size + 16,
        height: activeUnit._size + 16,
        class: 'atlas-guide atlas-guide-reticle'
      })
    );

    for (const neighbor of activeUnit.atlas.neighbors || []) {
      const target = state.unitByID.get(neighbor.id);
      if (!target) {
        continue;
      }

      const relationWeight = ((activeUnit._stateWeight ?? 1) + (target._stateWeight ?? 1)) / 2;
      const targetCenterX = target._x + (target._size / 2);
      const targetCenterY = target._y + (target._size / 2);

      edges.append(createSvgNode('line', {
        x1: activeCenterX,
        y1: activeCenterY,
        x2: targetCenterX,
        y2: targetCenterY,
        class: 'atlas-edge atlas-edge-neighbor',
        'stroke-width': Math.min(1.7, 1 + ((relationWeight - 1) * 1.25)),
        opacity: Math.min(0.92, 0.68 + ((relationWeight - 1) * 0.45))
      }));
    }

  }

  const selectedClusterID = activeUnit?.atlas.position.cluster_id;
  const visibleRegions = regionCenters(state).filter((region, index) => {
    if (region.id === selectedClusterID) {
      return true;
    }
    return region.size >= 8 && index < 5;
  });

  for (const region of visibleRegions) {
    const isActive = region.id === selectedClusterID;
    if (!isActive) {
      continue;
    }
    const group = createSvgNode('g', {
      class: `atlas-region ${isActive ? 'is-active' : ''}`
    });
    const label = createSvgNode('text', {
      x: region.x,
      y: region.y - 14,
      class: 'atlas-region-label'
    });
    label.textContent = region.name.toUpperCase();
    const tagWidth = Math.max(92, (region.name.length * 7) + 26);
    const tag = createSvgNode('rect', {
      x: region.x - (tagWidth / 2),
      y: region.y - 26,
      width: tagWidth,
      height: 16,
      class: 'atlas-region-tag'
    });
    group.append(tag);
    group.append(label);
    regions.append(group);
  }

  const orderedUnits = state.units.slice().sort((left, right) => {
    const weightDelta = (left._stateWeight ?? 1) - (right._stateWeight ?? 1);
    if (weightDelta !== 0) {
      return weightDelta;
    }
    return left.id - right.id;
  });

  for (const unit of orderedUnits) {
    let entry = state.nodeElements.get(unit.id);

    if (!entry) {
      const nodeGroup = createSvgNode('g', {
        tabindex: '0',
        role: 'button',
        'aria-label': `Unit ${unit.id}`
      });
      nodeGroup.dataset.unitId = String(unit.id);
      const hitbox = createSvgNode('rect', {
        x: 0,
        y: 0,
        width: unit._size,
        height: unit._size,
        class: 'atlas-node-hitbox'
      });
      const halo = createSvgNode('rect', {
        x: -3,
        y: -3,
        width: unit._size + 6,
        height: unit._size + 6,
        class: 'atlas-node-halo'
      });
      const circle = createSvgNode('rect', {
        x: 0,
        y: 0,
        width: unit._size,
        height: unit._size,
        class: 'atlas-node-dot'
      });
      const label = createSvgNode('text', { x: unit._size / 2, y: -10, class: 'atlas-node-label' });
      label.textContent = String(unit.id);

      nodeGroup.append(hitbox, halo, circle, label);
      nodeGroup.addEventListener('click', () => focusUnit(state, unit.id));
      hitbox.addEventListener('pointerenter', () => {
        updateHoverUnit(state, unit);
      });
      hitbox.addEventListener('pointerleave', () => {
        updateHoverUnit(state, null);
      });
      nodeGroup.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          focusUnit(state, unit.id);
        }
      });

      state.nodeLayer.append(nodeGroup);
      entry = { nodeGroup, hitbox, halo, circle, label };
      state.nodeElements.set(unit.id, entry);
    }

    entry.nodeGroup.setAttribute('class', buildNodeClass(unit, state));
    entry.nodeGroup.setAttribute('transform', `translate(${unit._x} ${unit._y})`);
    entry.hitbox.setAttribute('x', '0');
    entry.hitbox.setAttribute('y', '0');
    entry.hitbox.setAttribute('width', String(unit._size));
    entry.hitbox.setAttribute('height', String(unit._size));
    entry.halo.setAttribute('x', '-3');
    entry.halo.setAttribute('y', '-3');
    entry.halo.setAttribute('width', String(unit._size + 6));
    entry.halo.setAttribute('height', String(unit._size + 6));
    entry.circle.setAttribute('x', '0');
    entry.circle.setAttribute('y', '0');
    entry.circle.setAttribute('width', String(unit._size));
    entry.circle.setAttribute('height', String(unit._size));
    entry.circle.setAttribute('fill', '#ffffff');
    entry.circle.style.removeProperty('opacity');
    entry.circle.style.setProperty('--node-base-opacity', String(Math.min(1, 0.48 + ((unit._stateWeight ?? 1) - 1) * 0.8)));
    entry.label.setAttribute('x', String(unit._size / 2));
    entry.label.setAttribute('y', String(-(unit._size + 8)));
    state.nodeLayer.append(entry.nodeGroup);
  }
}

function focusUnit(state, unitID) {
  const unit = state.unitByID.get(Number(unitID));
  if (!unit) {
    return;
  }

  state.selectedUnit = unit;
  state.hoverUnit = null;
  state.search.value = String(unit.id);
  const cluster = state.clusterByID.get(unit.atlas.position.cluster_id);
  const publicRecord = state.publicUnitByID?.get(unit.id);
  document.getElementById('atlas-unit-profile').innerHTML = renderReadout(unit, cluster, publicRecord);
  drawTopology(state);
  bindTargetButtons(state);

  const params = new URLSearchParams(window.location.search);
  params.set('unit', String(unit.id));
  history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
}

async function loadAtlas() {
  const [atlasResponse, unitsResponse] = await Promise.all([
    fetch('atlas.json', { cache: 'no-store' }),
    fetch('units.json', { cache: 'no-store' })
  ]);
  const payload = await atlasResponse.json();
  const unitsPayload = await unitsResponse.json();

  if (!atlasResponse.ok) {
    throw new Error('UNABLE TO LOAD ARCHIVE FIELD.');
  }

  const units = Array.isArray(payload.units) ? payload.units.slice().sort((left, right) => left.id - right.id) : [];
  const clusters = Array.isArray(payload.clusters) ? payload.clusters.slice().sort((left, right) => {
    if (left.size !== right.size) {
      return right.size - left.size;
    }
    return left.representative_unit - right.representative_unit;
  }) : [];

  const clusterByID = new Map(clusters.map((cluster) => [cluster.id, cluster]));
  const publicUnits = Array.isArray(unitsPayload?.units) ? unitsPayload.units : [];
  units.forEach((unit) => {
    unit.clusterSize = clusterByID.get(unit.atlas.position.cluster_id)?.size || 1;
  });

  const state = {
    units,
    clusters,
    clusterByID,
    unitByID: new Map(units.map((unit) => [unit.id, unit])),
    publicUnitByID: new Map(publicUnits.map((unit) => [unit.id, unit])),
    svg: document.getElementById('atlas-topology'),
    search: document.getElementById('atlas-unit-search'),
    selectedUnit: null,
    hoverUnit: null,
    nodeElements: new Map(),
    topologyLayer: null,
    guideLayer: null,
    edgeLayer: null,
    regionLayer: null,
    nodeLayer: null
  };

  state.svg.addEventListener('mouseleave', () => {
    updateHoverUnit(state, null);
  });

  const totalUnits = payload.unit_count || units.length;
  const totalLabel = document.getElementById('atlas-unit-total');
  if (totalLabel) {
    totalLabel.textContent = `/ ${totalUnits}`;
  }

  bindTargetButtons(state);

  state.search.addEventListener('input', () => {
    const value = Number(String(state.search.value || '').trim());
    if (Number.isFinite(value)) {
      focusUnit(state, value);
    }
  });

  window.addEventListener('resize', () => {
    drawTopology(state);
  });

  applyFieldLayout(state);
  drawTopology(state);
  focusUnit(state, Number(new URLSearchParams(window.location.search).get('unit')) || units[0]?.id);
}

loadAtlas().catch((error) => {
  const message = error instanceof Error ? error.message : 'UNABLE TO LOAD ARCHIVE FIELD.';
  document.getElementById('atlas-unit-profile').innerHTML = `<p class="muted">${escapeHTML(message)}</p>`;
});
