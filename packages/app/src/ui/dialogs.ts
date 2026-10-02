/** Dialogs: Export as SVG, Share, About. */

import type { Store } from '../state/store.js';

function dialogFrame(title: string): { dlg: HTMLDialogElement; body: HTMLElement } {
  const dlg = document.createElement('dialog');
  dlg.className = 'sps-dialog';
  dlg.innerHTML = `<h2>${title}</h2>`;
  const body = document.createElement('div');
  dlg.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'sps-dialog-actions';
  const cancel = document.createElement('button');
  cancel.className = 'sps-btn';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dlg.close());
  actions.appendChild(cancel);
  dlg.appendChild(actions);

  dlg.addEventListener('close', () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  return { dlg, body };
}

function field(label: string, value: string, onChange?: (v: string) => void): HTMLLabelElement {
  const l = document.createElement('label');
  l.innerHTML = `<span>${label}</span>`;
  const input = document.createElement('input');
  input.className = 'sps-input';
  input.value = value;
  input.addEventListener('change', () => onChange?.(input.value));
  l.appendChild(input);
  return l;
}

function check(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
  const l = document.createElement('label');
  l.className = 'sps-check';
  l.innerHTML = `<span>${label}</span>`;
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.addEventListener('change', () => onChange(cb.checked));
  l.prepend(cb);
  return l;
}

export function openExportDialog(store: Store): void {
  const { dlg, body } = dialogFrame('Export as SVG');

  const state = store.state;
  let fillOn = state.settings.fill;
  let fill = '#000000';
  let strokeOn = false;
  let stroke = '#FF0000';
  let strokeWidth = 0.1;
  let vb = { ...state.viewBox };

  const styleRow = document.createElement('div');
  styleRow.className = 'sps-field-row';

  const preview = document.createElement('div');
  preview.className = 'sps-preview-box';

  const vbRow = document.createElement('div');

  const renderPreview = (): void => {
    preview.replaceChildren();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    svg.style.width = '100%';
    svg.style.height = '100%';
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', store.state.path.asString(10, false));
    path.setAttribute('fill', fillOn ? fill : 'none');
    if (strokeOn) {
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', String(strokeWidth));
    }
    svg.appendChild(path);
    preview.appendChild(svg);
  };

  styleRow.appendChild(check('Fill', fillOn, (v) => { fillOn = v; renderPreview(); }));
  styleRow.appendChild(check('Stroke', strokeOn, (v) => { strokeOn = v; renderPreview(); }));
  body.appendChild(styleRow);

  const colorRow = document.createElement('div');
  colorRow.className = 'sps-field-row';
  colorRow.appendChild(field('Fill Color', fill, (v) => { fill = v; renderPreview(); }));
  colorRow.appendChild(field('Stroke Color', stroke, (v) => { stroke = v; renderPreview(); }));
  colorRow.appendChild(field('Stroke width', String(strokeWidth), (v) => { strokeWidth = Number(v) || 0.1; renderPreview(); }));
  body.appendChild(colorRow);

  const vbHeader = document.createElement('div');
  vbHeader.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin:10px 0 6px';
  vbHeader.innerHTML = '<strong>ViewBox</strong>';
  const reset = document.createElement('button');
  reset.className = 'sps-btn';
  reset.textContent = 'Reset';
  reset.addEventListener('click', () => {
    vb = { ...store.state.viewBox };
    refreshVB();
    renderPreview();
  });
  vbHeader.appendChild(reset);
  body.appendChild(vbHeader);

  vbRow.className = 'sps-field-row';
  const inputs: Record<string, HTMLInputElement> = {};
  for (const k of ['x', 'y', 'width', 'height'] as const) {
    const f = field(k, String(round(vb[k], 3)), (v) => {
      vb[k] = Number(v) || 0;
      renderPreview();
    });
    inputs[k] = f.querySelector('input')!;
    vbRow.appendChild(f);
  }
  body.appendChild(vbRow);

  const refreshVB = (): void => {
    for (const k of ['x', 'y', 'width', 'height'] as const) inputs[k]!.value = String(round(vb[k], 3));
  };

  const previewWrap = document.createElement('div');
  previewWrap.style.cssText = 'display:flex;gap:14px;align-items:flex-start;margin-top:10px';
  previewWrap.append(preview);
  body.appendChild(previewWrap);
  renderPreview();

  const actions = dlg.querySelector('.sps-dialog-actions')!;
  const copyBtn = document.createElement('button');
  copyBtn.className = 'sps-btn';
  copyBtn.textContent = 'Copy to clipboard';
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard.writeText(exportSvgString(store, vb, { fillOn, fill, strokeOn, stroke, strokeWidth }));
  });
  const dl = document.createElement('button');
  dl.className = 'sps-btn sps-btn-primary';
  dl.textContent = 'Download';
  dl.addEventListener('click', () => {
    const blob = new Blob([exportSvgString(store, vb, { fillOn, fill, strokeOn, stroke, strokeWidth })], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'path.svg';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  actions.append(copyBtn, dl);
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}

export function exportSvgString(store: Store, vb: Store['state']['viewBox'], style: { fillOn: boolean; fill: string; strokeOn: boolean; stroke: string; strokeWidth: number }): string {
  const attrs = [
    `xmlns="http://www.w3.org/2000/svg"`,
    `viewBox="${round(vb.x, 3)} ${round(vb.y, 3)} ${round(vb.width, 3)} ${round(vb.height, 3)}"`
  ];
  const pathAttrs: string[] = [`d="${store.state.path.asString(6, store.state.settings.minify)}"`];
  if (style.fillOn) pathAttrs.push(`fill="${style.fill}"`);
  else pathAttrs.push('fill="none"');
  if (style.strokeOn) pathAttrs.push(`stroke="${style.stroke}"`, `stroke-width="${style.strokeWidth}"`);
  return `<svg ${attrs.join(' ')}>\n  <path ${pathAttrs.join(' ')}/>\n</svg>\n`;
}

export function openShareDialog(store: Store, makeShareUrl: (s: Store) => string): void {
  const { dlg, body } = dialogFrame('Share');
  const url = makeShareUrl(store);
  const row = document.createElement('div');
  row.className = 'sps-field-row';
  const input = field('Shareable URL', url);
  input.querySelector('input')!.readOnly = true;
  input.style.flex = '1';
  row.appendChild(input);
  body.appendChild(row);

  const actions = dlg.querySelector('.sps-dialog-actions')!;
  const copy = document.createElement('button');
  copy.className = 'sps-btn sps-btn-primary';
  copy.textContent = 'Copy to clipboard';
  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(url);
  });
  actions.prepend(copy);
}

export function openAboutDialog(): void {
  const { dlg, body } = dialogFrame('About SVG Path Studio');
  const heading = dlg.querySelector<HTMLHeadingElement>('h2')!;
  heading.classList.add('sps-about-heading');
  const appIcon = document.createElement('img');
  appIcon.src = `${import.meta.env.BASE_URL}icon.svg`;
  appIcon.alt = '';
  appIcon.width = 32;
  appIcon.height = 32;
  heading.prepend(appIcon);
  body.innerHTML = `
    <p><strong>SVG Path Studio</strong> | edit SVG paths with precision, in your browser.</p>
  `;
  const actions = dlg.querySelector('.sps-dialog-actions')!;
  const ok = document.createElement('button');
  ok.className = 'sps-btn sps-btn-primary';
  ok.textContent = 'Close';
  ok.addEventListener('click', () => dlg.close());
  actions.appendChild(ok);
}
