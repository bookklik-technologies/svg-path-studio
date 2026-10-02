import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Headless verification that the built bundle is self-consistent:
 * - contains the app bootstrap (canvas creation, panels, dialogs)
 * - contains core engine markers
 * - references the service worker registration
 */
describe('built bundle integrity', () => {
  it('dist bundle contains all app subsystems', () => {
    const js = readFileSync('dist/assets/' + readFileSync('dist/index.html', 'utf8').match(/assets\/index-[\w-]+\.js/)![0]!.split('/').pop()!, 'utf8');
    for (const marker of ['sps-canvas', 'sps-sidebar', 'Export as SVG', 'Share', 'Snap to Grid', 'Path Operations', 'serviceWorker', 'data-sps', 'Start Path From Here', 'Reverse Subpath']) {
      expect(js, marker).toContain(marker);
    }
  });

  it('dist CSS contains both themes', () => {
    const css = readFileSync('dist/assets/' + readFileSync('dist/index.html', 'utf8').match(/assets\/index-[\w-]+\.css/)![0]!.split('/').pop()!, 'utf8');
    expect(css).toContain('#17181c'); // dark canvas token
    expect(css).toContain('data-theme'); // light theme selector present (quote style may vary)
  });

  it('index.html wires the app root', () => {
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).toContain('id="app"');
    expect(html).toContain('SVG Path Studio');
  });

  it('service worker is emitted', () => {
    const sw = readFileSync('dist/sw.js', 'utf8');
    expect(sw).toContain('sps-v1');
  });

  void vi;
});
