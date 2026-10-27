/**
 * Shareable URLs and session persistence.
 * State encoding: JSON → deflate-raw via CompressionStream → base64url.
 */

import type { Store } from '../state/store.js';
import { SpsPath } from '@bookklik/svg-path-studio';

export interface SharedState {
  d: string;
  vb: { x: number; y: number; width: number; height: number };
  settings?: Partial<Store['state']['settings']>;
}

export async function encodeState(state: SharedState): Promise<string> {
  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  if ('CompressionStream' in window) {
    const cs = new CompressionStream('deflate-raw');
    const stream = new Response(new Blob([new Uint8Array(bytes)].map(b => b.slice().buffer as ArrayBuffer))).body!.pipeThrough(cs);
    const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
    return base64url(compressed);
  }
  return base64url(bytes);
}

export async function decodeState(hash: string): Promise<SharedState | null> {
  const bytes = debase64url(hash);
  const parse = (json: string): SharedState | null => {
    try {
      const parsed = JSON.parse(json) as SharedState;
      return parsed && typeof parsed.d === 'string' ? parsed : null;
    } catch {
      return null;
    }
  };
  // Links are deflate-raw compressed (encodeState); older links are plain
  // base64url JSON. Try the compressed form first, then the raw form.
  if ('DecompressionStream' in window) {
    try {
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([asBlobPart(bytes)]).stream().pipeThrough(ds);
      const json = new TextDecoder().decode(await new Response(stream).arrayBuffer());
      const parsed = parse(json);
      if (parsed) return parsed;
    } catch {
      /* not compressed — fall through to plain JSON */
    }
  }
  return parse(new TextDecoder().decode(bytes));
}

/** BlobPart-safe copy of a Uint8Array (TS 5.7 ArrayBufferLike strictness). */
function asBlobPart(bytes: Uint8Array): BlobPart {
  return bytes.slice().buffer as ArrayBuffer;
}

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function debase64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function makeShareUrl(store: Store): Promise<string> {
  const state = store.state;
  const payload: SharedState = {
    d: state.path.asString(6, state.settings.minify),
    vb: { ...state.viewBox },
    settings: { snap: state.settings.snap, fill: state.settings.fill, precision: state.settings.precision, theme: state.settings.theme, ticks: state.settings.ticks, tickNumbers: state.settings.tickNumbers }
  };
  // Same compressed encoding applyFromHash expects — keep these in sync.
  return `${location.origin}${location.pathname}#p=${await encodeState(payload)}`;
}

/** Outcome of reading a share link from the URL hash. */
export type HashApplyResult = 'none' | 'ok' | 'invalid';

export async function applyFromHash(store: Store, hash: string): Promise<HashApplyResult> {
  const m = hash.match(/p=([^&]+)/);
  if (!m) return 'none';
  const state = await decodeState(m[1]!);
  if (!state || !state.d) return 'invalid';
  try {
    store.update((s) => {
      s.path = new SpsPath(state.d);
      s.viewBox = { ...state.vb };
      if (state.settings) Object.assign(s.settings, state.settings);
      s.path.refreshAbsolutePositions();
    });
  } catch {
    return 'invalid';
  }
  return 'ok';
}

const LS_KEY = 'sps-session';

export function persistSession(store: Store): void {
  const state = store.state;
  try {
    localStorage.setItem(
      LS_KEY,
      JSON.stringify({
        d: state.path.asString(6, false),
        vb: state.viewBox,
        settings: state.settings,
        v: 1
      })
    );
  } catch {
    /* storage full/unavailable */
  }
}

export interface PersistedSession {
  d: string;
  vb: Store['state']['viewBox'];
  settings: Store['state']['settings'];
  v: number;
}

export function readSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PersistedSession) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
