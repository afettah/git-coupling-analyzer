import { useEffect, useRef, useState } from 'react';
import { startMockProgressStream } from '../mocks/progressMock';

interface UseSSEOptions<T> {
  enabled?: boolean;
  eventName?: string;
  onData?: (payload: T) => void;
  isTerminal?: (payload: T) => boolean;
  maxReconnectDelayMs?: number;
  maxReconnectAttempts?: number;
}

interface UseSSEResult<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
}

const MOCK_PREFIX = 'mock://';

function parseMockRunId(url: string): string {
  return url.replace(MOCK_PREFIX, '').replace(/^analysis\//, '');
}

export function useSSE<T>(url: string | null, options: UseSSEOptions<T> = {}): UseSSEResult<T> {
  const {
    enabled = true,
    eventName = 'progress',
    onData,
    isTerminal,
    maxReconnectDelayMs = 8000,
    maxReconnectAttempts = 12,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const onDataRef = useRef(onData);
  const isTerminalRef = useRef(isTerminal);

  useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);

  useEffect(() => {
    isTerminalRef.current = isTerminal;
  }, [isTerminal]);

  useEffect(() => {
    if (!enabled || !url) {
      return;
    }

    setError(null);

    if (url.startsWith(MOCK_PREFIX)) {
      setConnected(true);
      const stop = startMockProgressStream(parseMockRunId(url), (payload) => {
        const typedPayload = payload as T;
        setData(typedPayload);
        onDataRef.current?.(typedPayload);
      });

      return () => {
        stop();
        setConnected(false);
      };
    }

    let eventSource: EventSource | null = null;
    let cancelled = false;
    let shouldReconnect = true;

    const clearReconnect = () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const connect = () => {
      clearReconnect();
      eventSource = new EventSource(url);

      eventSource.addEventListener('open', () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
        setError(null);
      });

      eventSource.addEventListener(eventName, (event) => {
        try {
          const payload = JSON.parse((event as MessageEvent).data) as T;
          setData(payload);
          onDataRef.current?.(payload);

          if (isTerminalRef.current?.(payload)) {
            shouldReconnect = false;
            setConnected(false);
            eventSource?.close();
          }
        } catch {
          setError('Failed to parse progress payload.');
        }
      });

      eventSource.addEventListener('error', () => {
        setConnected(false);
        if (cancelled || !shouldReconnect) {
          return;
        }

        eventSource?.close();

        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        if (attempt > maxReconnectAttempts) {
          setError('Lost connection to analysis stream.');
          return;
        }
        const delay = Math.min(maxReconnectDelayMs, 500 * 2 ** attempt);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      });
    };

    connect();

    return () => {
      cancelled = true;
      shouldReconnect = false;
      clearReconnect();
      eventSource?.close();
      setConnected(false);
    };
  }, [enabled, eventName, maxReconnectAttempts, maxReconnectDelayMs, url]);

  return { data, connected, error };
}
