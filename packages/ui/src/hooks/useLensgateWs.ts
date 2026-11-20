import { useState, useEffect, useRef, useCallback } from 'react';
import {
  LensgateContextEnvelope,
  InterceptMode,
  ServerEvent,
} from '@lensgate/shared';

export interface InterceptedItem {
  envelope: LensgateContextEnvelope;
  modifiedBody?: any;
  receivedAt: number;
  completedAt?: number;
  durationMs?: number;
  statusCode?: number;
  streamText?: string;
}

export function useLensgateWs() {
  const [connected, setConnected] = useState(false);
  const [mode, setModeState] = useState<InterceptMode>('control');
  const [items, setItems] = useState<InterceptedItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data: ServerEvent = JSON.parse(event.data);

        if (data.type === 'proxy:status') {
          setModeState(data.mode);
        } else if (data.type === 'request:intercepted') {
          setItems((prev) => {
            const exists = prev.some((i) => i.envelope.id === data.envelope.id);
            if (exists) return prev;
            const newItem: InterceptedItem = {
              envelope: data.envelope,
              receivedAt: Date.now(),
            };
            return [newItem, ...prev];
          });
          setSelectedId((curr) => curr || data.envelope.id);
        } else if (data.type === 'request:stream_chunk') {
          setItems((prev) =>
            prev.map((item) =>
              item.envelope.id === data.requestId
                ? { ...item, streamText: (item.streamText || '') + data.chunk }
                : item
            )
          );
        } else if (data.type === 'request:completed') {
          setItems((prev) =>
            prev.map((item) =>
              item.envelope.id === data.requestId
                ? {
                    ...item,
                    completedAt: Date.now(),
                    durationMs: data.durationMs,
                    statusCode: data.statusCode,
                    envelope: {
                      ...item.envelope,
                      status: item.envelope.status === 'pending' ? 'forwarded' : item.envelope.status,
                    },
                  }
                : item
            )
          );
        }
      } catch (err) {
        console.error('[Lensgate UI] WS parse error:', err);
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  // Initial fetch for existing pending requests
  useEffect(() => {
    fetch('/api/pending')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.pending) && data.pending.length > 0) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => i.envelope.id));
            const newPending = data.pending
              .filter((p: LensgateContextEnvelope) => !existingIds.has(p.id))
              .map((envelope: LensgateContextEnvelope) => ({
                envelope,
                receivedAt: Date.now(),
              }));
            return [...newPending, ...prev];
          });
          setSelectedId((curr) => curr || data.pending[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const forwardRequest = useCallback((requestId: string, modifiedBody?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'action:forward',
          requestId,
          modifiedBody,
        })
      );
    } else {
      fetch('/api/action/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, modifiedBody }),
      });
    }

    setItems((prev) =>
      prev.map((item) =>
        item.envelope.id === requestId
          ? {
              ...item,
              modifiedBody,
              envelope: {
                ...item.envelope,
                status: modifiedBody ? 'modified' : 'forwarded',
              },
            }
          : item
      )
    );
  }, []);

  const dropRequest = useCallback((requestId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'action:drop',
          requestId,
        })
      );
    } else {
      fetch('/api/action/drop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });
    }

    setItems((prev) =>
      prev.map((item) =>
        item.envelope.id === requestId
          ? {
              ...item,
              envelope: {
                ...item.envelope,
                status: 'dropped',
              },
            }
          : item
      )
    );
  }, []);

  const setMode = useCallback((newMode: InterceptMode) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'config:set_mode',
          mode: newMode,
        })
      );
    } else {
      fetch('/api/config/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
    }
    setModeState(newMode);
  }, []);

  const updateItemModifiedBody = useCallback((requestId: string, modifiedBody: any) => {
    setItems((prev) =>
      prev.map((item) =>
        item.envelope.id === requestId
          ? { ...item, modifiedBody }
          : item
      )
    );
  }, []);

  const applyFix = useCallback(async (requestId: string, action: string) => {
    try {
      const res = await fetch('/api/intelligence/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.envelope) {
          setItems((prev) =>
            prev.map((item) =>
              item.envelope.id === requestId
                ? {
                    ...item,
                    envelope: data.envelope,
                    modifiedBody: data.envelope.modifiedBody,
                  }
                : item
            )
          );
          return data.envelope;
        }
      }
    } catch (err) {
      console.error('Failed to apply fix:', err);
    }
  }, []);

  return {
    connected,
    mode,
    setMode,
    items,
    selectedId,
    setSelectedId,
    forwardRequest,
    dropRequest,
    updateItemModifiedBody,
    applyFix,
  };
}

