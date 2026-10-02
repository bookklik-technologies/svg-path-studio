import '@bookklik/senangstart-icons';

/** App actions mapped to the locally bundled SenangStart icon component. */
const iconNames: Record<string, string> = {
  convert: 'arrow-left-arrow-right',
  startPath: 'arrow-up',
  reverse: 'arrow-up-arrow-down',
  delete: 'trash',
  undo: 'arrow-rotate-ccw',
  redo: 'arrow-rotate-cw',
  image: 'photo',
  download: 'arrow-down-tray',
  share: 'share',
  plus: 'plus',
  folder: 'folder-open',
  save: 'save',
  clear: 'x-mark',
  copy: 'document-duplicate',
  grid: 'grid',
  zoomIn: 'magnifying-glass-plus',
  zoomOut: 'magnifying-glass-minus',
  fit: 'focus',
  center: 'crosshair',
  theme: 'moon',
  lock: 'lock-closed',
  more: 'horizontal-3-dots',
  chevron: 'chevron-down',
};

export function icon(name: string): string {
  if (!Object.hasOwn(iconNames, name)) return '';
  return `<ss-icon class="sps-icon" icon="${iconNames[name]}" thickness="2" aria-hidden="true"></ss-icon>`;
}
