import { jsPDF } from 'jspdf';
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

/** Studio branding for the PDF header (Fase 11). */
export interface StudioBrand {
  studioName?: string;
  studioLogo?: string; // data URL
}

/** Rasterize the plan SVG into an A4 landscape PDF with a branded header:
 *  studio logo + name on the left, date on the right. */
export async function exportPdf(
  svgEl: SVGSVGElement,
  brand: StudioBrand,
  name: string,
): Promise<void> {
  const png = await svgToPngDataUrl(svgEl, 3);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const headerH = 22;

  // Header rule + branding
  let textX = margin;
  if (brand.studioLogo) {
    try {
      const logo = await loadImage(brand.studioLogo);
      const h = 14;
      const w = (logo.width / logo.height) * h;
      pdf.addImage(brand.studioLogo, margin, margin - 4, Math.min(w, 45), h);
      textX = margin + Math.min(w, 45) + 5;
    } catch {
      // corrupt logo: skip it, keep exporting
    }
  }
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.setTextColor(60, 66, 55);
  pdf.text(brand.studioName || 'Proposta planimetrica', textX, margin + 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(120, 120, 110);
  pdf.text('Proposta di progetto — PlanimetrieAI', textX, margin + 9.5);
  const date = new Date().toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  pdf.text(date, pageW - margin, margin + 4, { align: 'right' });
  pdf.setDrawColor(200, 196, 182);
  pdf.line(margin, margin + headerH - 8, pageW - margin, margin + headerH - 8);

  // Plan image fitted below the header
  const vb = svgEl.viewBox.baseVal;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - headerH;
  const scale = Math.min(availW / vb.width, availH / vb.height);
  const imgW = vb.width * scale;
  const imgH = vb.height * scale;
  pdf.addImage(png, 'PNG', (pageW - imgW) / 2, margin + headerH - 4 + (availH - imgH) / 2, imgW, imgH);

  pdf.save(`${name}.pdf`);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('immagine non caricabile'));
    img.src = src;
  });
}

function svgToPngDataUrl(svgEl: SVGSVGElement, scale: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const vb = svgEl.viewBox.baseVal;
    const svgData = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = vb.width * scale;
      canvas.height = vb.height * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('conversione SVG fallita'));
    };
    img.src = url;
  });
}

export function exportJson(plan: FloorPlan, name: string) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, `${name}.json`);
  URL.revokeObjectURL(url);
}
