const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');

const gradientType = document.getElementById('gradientType');
const angle = document.getElementById('angle');
const angleValue = document.getElementById('angleValue');
const color1 = document.getElementById('color1');
const color2 = document.getElementById('color2');
const color3 = document.getElementById('color3');
const palettePreset = document.getElementById('palettePreset');
const exportSize = document.getElementById('exportSize');
const customSizeControls = document.getElementById('customSizeControls');
const customWidth = document.getElementById('customWidth');
const customHeight = document.getElementById('customHeight');

const randomizeBtn = document.getElementById('randomizeBtn');
const swapBtn = document.getElementById('swapBtn');
const exportBtn = document.getElementById('exportBtn');

const palettes = {
  midnight: ['#020617', '#1e3a8a', '#38bdf8'],
  forest: ['#022c22', '#166534', '#86efac'],
  sunset: ['#7c2d12', '#f97316', '#fef08a'],
  mono: ['#111827', '#374151', '#d1d5db'],
};

function hex() {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
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
  gradient.addColorStop(0, color1.value);
  gradient.addColorStop(0.5, color2.value);
  gradient.addColorStop(1, color3.value);

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function renderPreview() {
  drawGradient(ctx, canvas.width, canvas.height);
}

function applyPalette(name) {
  const selected = palettes[name];
  if (!selected) {
    return;
  }
  [color1.value, color2.value, color3.value] = selected;
  renderPreview();
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

[gradientType, angle, color1, color2, color3].forEach((el) => {
  el.addEventListener('input', () => {
    angleValue.textContent = `${angle.value}°`;
    palettePreset.value = 'custom';
    renderPreview();
  });
});

palettePreset.addEventListener('change', () => {
  applyPalette(palettePreset.value);
});

randomizeBtn.addEventListener('click', () => {
  color1.value = hex();
  color2.value = hex();
  color3.value = hex();
  palettePreset.value = 'custom';
  renderPreview();
});

swapBtn.addEventListener('click', () => {
  [color1.value, color3.value] = [color3.value, color1.value];
  palettePreset.value = 'custom';
  renderPreview();
});

exportSize.addEventListener('change', () => {
  customSizeControls.classList.toggle('hidden', exportSize.value !== 'custom');
});

exportBtn.addEventListener('click', exportPng);

renderPreview();
