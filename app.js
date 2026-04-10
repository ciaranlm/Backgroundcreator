const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

const gradientType = document.getElementById('gradientType');
const meshDensity = document.getElementById('meshDensity');
const meshDensityValue = document.getElementById('meshDensityValue');
const meshSoftness = document.getElementById('meshSoftness');
const meshSoftnessValue = document.getElementById('meshSoftnessValue');
const angle = document.getElementById('angle');
const angleValue = document.getElementById('angleValue');
const palettePreset = document.getElementById('palettePreset');
const exportTargets = document.getElementById('exportTargets');
const customSizeControls = document.getElementById('customSizeControls');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');
const zipToggle = document.getElementById('zipToggle');
const exportStatus = document.getElementById('exportStatus');
const stopsContainer = document.getElementById('stopsContainer');
const addStopBtn = document.getElementById('addStopBtn');
const overlayProfile = document.getElementById('overlayProfile');
const overlayToggle = document.getElementById('overlayToggle');
const previewOverlay = document.getElementById('previewOverlay');

const randomizeBtn = document.getElementById('randomizeBtn');
const swapBtn = document.getElementById('swapBtn');
const exportBtn = document.getElementById('exportBtn');

const EXPORT_PRESETS = {
  '1290x2796': { width: 1290, height: 2796 },
  '1179x2556': { width: 1179, height: 2556 },
  '1440x3200': { width: 1440, height: 3200 },
  '1080x2400': { width: 1080, height: 2400 },
};

const palettes = {
  midnight: ['#020617', '#1e3a8a', '#38bdf8'],
  forest: ['#022c22', '#166534', '#86efac'],
  sunset: ['#7c2d12', '#f97316', '#fef08a'],
  mono: ['#111827', '#374151', '#d1d5db'],
};

const overlayProfileBySize = {
  '1290x2796': 'iphone-pro-max',
  '1179x2556': 'iphone-pro',
  '1440x3200': 'android-tall',
  '1080x2400': 'android-tall',
};

const MIN_STOPS = 2;
const ZIP_LIB_AVAILABLE = typeof window.JSZip !== 'undefined';

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

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mixHexWithWhite(hexColor, strength) {
  const amount = clamp(strength, 0, 1);
  const channels = [1, 3, 5].map((offset) => parseInt(hexColor.slice(offset, offset + 2), 16));
  const mixed = channels.map((channel) => Math.round(channel + (255 - channel) * amount));
  return `rgb(${mixed[0]} ${mixed[1]} ${mixed[2]})`;
}

function hexToRgbChannels(hexColor) {
  const channels = [1, 3, 5].map((offset) => parseInt(hexColor.slice(offset, offset + 2), 16));
  return `${channels[0]} ${channels[1]} ${channels[2]}`;
}

function drawMeshGradient(context, width, height, stops) {
  const sortedStops = normalizeStops(stops);
  const colors = sortedStops.map((stop) => stop.color);
  const count = clamp(Number(meshDensity.value) || 4, 3, 6);
  const softness = clamp(Number(meshSoftness.value) || 60, 20, 100) / 100;
  const minDimension = Math.min(width, height);
  const seedSource = [
    width,
    height,
    count,
    softness.toFixed(2),
    colors.join('-'),
  ].join('|');
  const random = createSeededRandom(hashString(seedSource));

  context.fillStyle = colors[0] || '#0f172a';
  context.fillRect(0, 0, width, height);

  for (let index = 0; index < count; index += 1) {
    const color = colors[index % colors.length];
    const centerX = width * (0.2 + random() * 0.6);
    const centerY = height * (0.18 + random() * 0.64);
    const radius = minDimension * (0.3 + random() * 0.38);
    const alphaBase = 0.09 + (1 - softness) * 0.06;
    const alpha = clamp(alphaBase + random() * 0.08, 0.08, 0.24);
    const highlight = mixHexWithWhite(color, softness * 0.22);
    const edge = mixHexWithWhite(color, 0.45 + softness * 0.2);
    const mid = hexToRgbChannels(color);
    const gradient = context.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius);
    gradient.addColorStop(0, highlight.replace(')', ` / ${alpha})`));
    gradient.addColorStop(0.7, `rgb(${mid} / ${alpha * 0.55})`);
    gradient.addColorStop(1, edge.replace(')', ' / 0)'));
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
}

function drawGradient(context, width, height) {
  const sortedStops = normalizeStops(gradientStops);

  if (gradientType.value === 'mesh') {
    drawMeshGradient(context, width, height, sortedStops);
    return;
  }

  const gradient = getGradient(context, width, height);

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

function updateMeshControlLabels() {
  meshDensityValue.textContent = String(clamp(Number(meshDensity.value), 3, 6));
  meshSoftnessValue.textContent = `${clamp(Number(meshSoftness.value), 20, 100)}%`;
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

function getCustomResolution() {
  const width = Number(customWidth.value);
  const height = Number(customHeight.value);

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return null;
  }

  if (width < 320 || width > 8000 || height < 320 || height > 8000) {
    return null;
  }

  return { width, height, key: 'custom' };
}

function getSelectedResolutions() {
  const selected = [];
  const checkedTargets = exportTargets.querySelectorAll('input[type="checkbox"]:checked');

  checkedTargets.forEach((target) => {
    const value = target.value;
    if (value === 'custom') {
      const custom = getCustomResolution();
      if (custom) {
        selected.push(custom);
      }
      return;
    }

    const preset = EXPORT_PRESETS[value];
    if (preset) {
      selected.push({ ...preset, key: value });
    }
  });

  return selected;
}

function getSuggestedOverlayProfile(width, height) {
  if (!width || !height) {
    return 'none';
  }

  const exact = overlayProfileBySize[`${width}x${height}`];
  if (exact) {
    return exact;
  }

  const ratio = height / width;
  if (ratio >= 2.2) {
    return 'android-tall';
  }

  if (ratio >= 2.14) {
    return 'iphone-pro-max';
  }

  return 'none';
}

function syncOverlayToExportSize() {
  const resolutions = getSelectedResolutions();
  const primary = resolutions[0] || EXPORT_PRESETS['1290x2796'];
  overlayProfile.value = getSuggestedOverlayProfile(primary.width, primary.height);
  previewOverlay.dataset.profile = overlayProfile.value;
}

function updateOverlayVisibility() {
  const isVisible = overlayToggle.checked && overlayProfile.value !== 'none';
  previewOverlay.classList.toggle('hidden', !isVisible);
}

function applyOverlaySelection() {
  previewOverlay.dataset.profile = overlayProfile.value;
  updateOverlayVisibility();
}

function createFilename(width, height, dateTag) {
  return `minimal-gradient-${width}x${height}-${dateTag}.png`;
}

function setExportStatus(message, tone = 'muted') {
  exportStatus.textContent = message;
  exportStatus.dataset.tone = tone;
}

function blobFromCanvas(exportCanvas) {
  return new Promise((resolve) => {
    exportCanvas.toBlob((blob) => {
      resolve(blob || null);
    }, 'image/png');
  });
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function renderResolution(width, height) {
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportContext = exportCanvas.getContext('2d');
  drawGradient(exportContext, width, height);
  return blobFromCanvas(exportCanvas);
}

function updateExportUiState() {
  const customChecked = Boolean(exportTargets.querySelector('input[value="custom"]')?.checked);
  customSizeControls.classList.toggle('hidden', !customChecked);

  const customValid = !customChecked || Boolean(getCustomResolution());
  const selectedResolutions = getSelectedResolutions();
  const hasTargets = selectedResolutions.length > 0;

  exportBtn.disabled = !hasTargets || !customValid;

  if (!hasTargets) {
    setExportStatus('Select at least one export target to enable batch export.');
  } else if (!customValid) {
    setExportStatus('Custom size must be whole numbers between 320 and 8000.');
  } else if (zipToggle.checked && !ZIP_LIB_AVAILABLE) {
    setExportStatus('ZIP library unavailable. Exports will download one-by-one.', 'warning');
  } else if (zipToggle.checked && ZIP_LIB_AVAILABLE) {
    setExportStatus(`Ready to export ${selectedResolutions.length} file(s) as a ZIP.`);
  } else {
    setExportStatus(`Ready to export ${selectedResolutions.length} file(s).`);
  }

  syncOverlayToExportSize();
  updateOverlayVisibility();
}

async function exportZip(files, dateTag) {
  const zip = new window.JSZip();
  files.forEach((file) => {
    zip.file(file.filename, file.blob);
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(zipBlob, `minimal-gradient-batch-${dateTag}.zip`);
}

async function exportPngBatch() {
  const selected = getSelectedResolutions();
  if (!selected.length) {
    updateExportUiState();
    return;
  }

  exportBtn.disabled = true;
  const dateTag = new Date().toISOString().slice(0, 10);
  setExportStatus(`Rendering ${selected.length} export(s)...`);

  const files = [];
  for (const target of selected) {
    const blob = await renderResolution(target.width, target.height);
    if (!blob) {
      setExportStatus(`Failed rendering ${target.width}×${target.height}.`, 'warning');
      continue;
    }

    files.push({
      blob,
      filename: createFilename(target.width, target.height, dateTag),
    });
  }

  if (!files.length) {
    setExportStatus('No files were exported due to render failures.', 'warning');
    updateExportUiState();
    return;
  }

  if (zipToggle.checked && ZIP_LIB_AVAILABLE) {
    await exportZip(files, dateTag);
    setExportStatus(`Downloaded ZIP with ${files.length} PNG file(s).`);
  } else {
    files.forEach((file, index) => {
      setTimeout(() => downloadBlob(file.blob, file.filename), index * 150);
    });
    setExportStatus(`Downloaded ${files.length} PNG file(s) sequentially.`);
  }

  updateExportUiState();
}

[gradientType, angle, meshDensity, meshSoftness].forEach((el) => {
  el.addEventListener('input', () => {
    angleValue.textContent = `${angle.value}°`;
    updateMeshControlLabels();
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

exportTargets.addEventListener('change', updateExportUiState);
[customWidth, customHeight].forEach((input) => {
  input.addEventListener('input', updateExportUiState);
});
zipToggle.addEventListener('change', updateExportUiState);

overlayProfile.addEventListener('change', applyOverlaySelection);
overlayToggle.addEventListener('change', updateOverlayVisibility);

exportBtn.addEventListener('click', exportPngBatch);

if (!ZIP_LIB_AVAILABLE) {
  zipToggle.checked = false;
  zipToggle.disabled = true;
}

renderStopControls();
updateExportUiState();
applyOverlaySelection();
updateMeshControlLabels();
renderPreview();
