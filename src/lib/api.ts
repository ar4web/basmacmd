import { useState, useEffect, useCallback, useRef } from 'react';

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json();
    return j?.error || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

// Performance sampling — every API call is timed and logged to /api/perf
// (fire-and-forget, never blocks the UI, /api/perf itself excluded to avoid recursion).
function logPerf(path: string, started: number, ok: boolean) {
  if (path.includes('/api/perf')) return;
  const durationMs = Math.round(performance.now() - started);
  fetch('/api/perf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: path.split('?')[0], duration_ms: durationMs, ok }),
    keepalive: true,
  }).catch(() => undefined);
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const t0 = performance.now();
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(await parseError(res));
    logPerf(path, t0, true);
    return res.json() as Promise<T>;
  } catch (err) {
    logPerf(path, t0, false);
    throw err;
  }
}

export async function apiSend<T = unknown>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const t0 = performance.now();
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await parseError(res));
    logPerf(path, t0, true);
    return res.json() as Promise<T>;
  } catch (err) {
    logPerf(path, t0, false);
    throw err;
  }
}

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T = unknown>(path: string | null, deps: unknown[] = []): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const json = await apiGet<T>(path);
      if (mounted.current) setData(json);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ...deps]);

  return { data, loading, error, refetch: load };
}
