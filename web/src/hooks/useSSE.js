import { useEffect, useRef, useState } from 'react';

/**
 * Opt-in live refresh. Only connects when `enabled` is true (the user flips the
 * toggle), honoring the "auto, with permission" behavior.
 */
export function useSSE(enabled, onChange) {
  const [connected, setConnected] = useState(false);
  const [lastChange, setLastChange] = useState(null);
  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    const es = new EventSource('/api/events');
    es.addEventListener('ready', () => setConnected(true));
    es.addEventListener('change', (e) => {
      try {
        const data = JSON.parse(e.data);
        setLastChange(data);
        cbRef.current?.(data);
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [enabled]);

  return { connected, lastChange };
}
