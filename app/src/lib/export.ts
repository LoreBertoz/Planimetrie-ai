import type { FloorPlan } from '../types';

function download(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function exportSvg(svgEl: SVGSVGElement, name: string) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  download(url, `${name}.svg`);
  URL.revokeObjectURL(url);
}

export function exportPng(svgEl: SVGSVGElement, name: string, scale = 3) {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const vb = svgEl.viewBox.baseVal;
  const svgData = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      download(pngUrl, `${name}.png`);
      URL.revokeObjectURL(pngUrl);
    });
  };
  img.src = url;
}

export function exportJson(plan: FloorPlan, name: string) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `${name}.json`);
  URL.revokeObjectURL(url);
}
