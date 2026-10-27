/** Lightweight transient toast for action feedback (copy, share, errors). */

let host: HTMLElement | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string, kind: 'info' | 'error' = 'info'): void {
  if (!host) {
    host = document.createElement('div');
    host.className = 'sps-toast';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  host.textContent = message;
  host.classList.toggle('sps-toast-error', kind === 'error');
  host.classList.add('sps-toast-visible');
  clearTimeout(timer);
  timer = setTimeout(() => {
    host!.classList.remove('sps-toast-visible');
  }, 2400);
}

/** Copy to the clipboard with toast feedback and a textarea fallback. */
export async function copyText(text: string, label = 'Copied to clipboard'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    // Clipboard API can be unavailable (permissions, http contexts).
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      toast(ok ? label : 'Copy failed — select the text and copy manually', ok ? 'info' : 'error');
    } catch {
      toast('Copy failed — select the text and copy manually', 'error');
    }
  }
}
