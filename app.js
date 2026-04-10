const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

const gradientType = document.getElementById('gradientType');
const angle = document.getElementById('angle');
const angleValue = document.getElementById('angleValue');
const palettePreset = document.getElementById('palettePreset');
const exportSize = document.getElementById('exportSize');
const customSizeControls = document.getElementById('customSizeControls');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const stopsContainer = document.getElementById('stopsContainer');
const addStopBtn = document.getElementById('addStopBtn');

const randomizeBtn = document.getElementById('randomizeBtn');
const swapBtn = document.getElementById('swapBtn');
const exportBtn = document.getElementById('exportBtn');

const palettes = {
  midnight: ['#020617', '#1e3a8a', '#38bdf8'],
  forest: ['#022c22', '#166534', '#86efac'],
  sunset: ['#7c2d12', '#f97316', '#fef08a'],
  mono: ['#111827', '#374151', '#d1d5db'],
};

const MIN_STOPS = 2;

let gradientStops = [
  { position: 0, color: '#0f172a' },
  { position: 0.5, color: '#1d4ed8' },
  { position: 1, color: '#22d3ee' },
];

function hex() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeStops(stops) {
  const source = Array.isArray(stops) ? stops : [];
  const cleaned = source
    .map((stop) => {
      const rawPosition =
        typeof stop.position === 'number'
          ? stop.position
          : Number(stop.position) / (Number(stop.position) > 1 ? 100 : 1);

      return {
        position: clamp(Number.isFinite(rawPosition) ? rawPosition : 0, 0, 1),
        color: typeof stop.color === 'string' ? stop.color : '#000000',
      };
    })
    .filter((stop) => /^#[0-9a-fA-F]{6}$/.test(stop.color));

  if (!cleaned.length) {
    return [
      { position: 0, color: '#000000' },
      { position: 1, color: '#ffffff' },
    ];
  }

  if (cleaned.length === 1) {
    cleaned.push({ position: 1, color: cleaned[0].color });
    cleaned[0].position = 0;
  }

  return cleaned
    .sort((a, b) => a.position - b.position)
    .map((stop, index, arr) => {
      if (index === 0) return { ...stop, position: 0 };
      if (index === arr.length - 1) return { ...stop, position: 1 };
      return stop;
    });
}

function buildStopsFromColors(colors) {
  const list = Array.isArray(colors) ? colors : [];
  const divisor = Math.max(1, list.length - 1);
  return list.map((color, index) => ({
    position: index / divisor,
    color,
  }));
}

function getGradient(context, width, height) {
  const a = Number(angle.value) * (Math.PI / 180);
  const x = Math.cos(a);
  const y = Math.sin(a);

  if (gradientType.value === 'radial') {
    return context.createRadialGradient(
      width * 0.5,
      height * 0.42,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height)
    );
  }

  if (gradientType.value === 'conic') {
    return context.createConicGradient(a, width / 2, height / 2);
  }

  const x0 = width * (0.5 - x * 0.5);
  const y0 = height * (0.5 - y * 0.5);
  const x1 = width * (0.5 + x * 0.5);
  const y1 = height * (0.5 + y * 0.5);
  return context.createLinearGradient(x0, y0, x1, y1);
}

function drawGradient(context, width, height) {
  const gradient = getGradient(context, width, height);
  const sortedStops = normalizeStops(gradientStops);

  sortedStops.forEach((stop) => {
    gradient.addColorStop(stop.position, stop.color);
  });

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function renderStopControls() {
  stopsContainer.innerHTML = '';

  gradientStops.forEach((stop, index) => {
    const row = document.createElement('div');
    row.className = 'stop-row';
    row.innerHTML = `
      <label>
        Stop ${index + 1} Position
        <input type="number" min="0" max="100" step="1" value="${Math.round(
          clamp(stop.position, 0, 1) * 100
        )}" data-stop-position="${index}" />
      </label>
      <input type="color" value="${stop.color}" data-stop-color="${index}" aria-label="Stop ${
      index + 1
    } color" />
      <button type="button" class="secondary" data-remove-stop="${index}" ${
      gradientStops.length <= MIN_STOPS ? 'disabled' : ''
    }>Remove</button>
    `;

    stopsContainer.appendChild(row);
  });
}

function renderPreview() {
  drawGradient(ctx, canvas.width, canvas.height);
}

function setStops(stops) {
  gradientStops = normalizeStops(stops);
  renderStopControls();
  renderPreview();
}

function applyPalette(name) {
  const selected = palettes[name];
  if (!selected) {
    return;
  }

  if (Array.isArray(selected)) {
    setStops(buildStopsFromColors(selected));
    return;
  }

  if (Array.isArray(selected.stops)) {
    setStops(selected.stops);
  }
}

function getExportResolution() {
  if (exportSize.value === 'custom') {
    return {
      width: Math.max(320, Number(customWidth.value || 1440)),
      height: Math.max(320, Number(customHeight.value || 3200)),
    };
  }

  const [width, height] = exportSize.value.split('x').map(Number);
  return { width, height };
}

function exportPng() {
  const { width, height } = getExportResolution();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportContext = exportCanvas.getContext('2d');

  drawGradient(exportContext, width, height);

  exportCanvas.toBlob((blob) => {
    if (!blob) return;

    const link = document.createElement('a');
    const dateTag = new Date().toISOString().slice(0, 10);
    link.download = `minimal-gradient-${width}x${height}-${dateTag}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }, 'image/png');
}

[gradientType, angle].forEach((el) => {
  el.addEventListener('input', () => {
    angleValue.textContent = `${angle.value}°`;
    palettePreset.value = 'custom';
    renderPreview();
  });
});

stopsContainer.addEventListener('input', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  const positionIndex = target.dataset.stopPosition;
  if (positionIndex !== undefined) {
    const index = Number(positionIndex);
    const percent = clamp(Number(target.value), 0, 100);
    gradientStops[index].position = percent / 100;
    target.value = String(Math.round(percent));
    palettePreset.value = 'custom';
    renderPreview();
    return;
  }

  const colorIndex = target.dataset.stopColor;
  if (colorIndex !== undefined) {
    const index = Number(colorIndex);
    gradientStops[index].color = target.value;
    palettePreset.value = 'custom';
    renderPreview();
  }
});

stopsContainer.addEventListener('click', (event) => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const removeIndex = target.dataset.removeStop;
  if (removeIndex === undefined || gradientStops.length <= MIN_STOPS) {
    return;
  }

  gradientStops.splice(Number(removeIndex), 1);
  palettePreset.value = 'custom';
  renderStopControls();
  renderPreview();
});

addStopBtn.addEventListener('click', () => {
  const sorted = normalizeStops(gradientStops);
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2] || { position: 0 };

  gradientStops.push({
    position: clamp((last.position + prev.position) / 2, 0, 1),
    color: hex(),
  });

  palettePreset.value = 'custom';
  renderStopControls();
  renderPreview();
});

palettePreset.addEventListener('change', () => {
  applyPalette(palettePreset.value);
});

randomizeBtn.addEventListener('click', () => {
  gradientStops = gradientStops.map((stop) => ({ ...stop, color: hex() }));
  palettePreset.value = 'custom';
  renderStopControls();
  renderPreview();
});

swapBtn.addEventListener('click', () => {
  gradientStops.reverse();
  palettePreset.value = 'custom';
  renderStopControls();
  renderPreview();
});

exportSize.addEventListener('change', () => {
  customSizeControls.classList.toggle('hidden', exportSize.value !== 'custom');
});

exportBtn.addEventListener('click', exportPng);

renderStopControls();
renderPreview();
