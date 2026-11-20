import { UpstreamPayload, BaseAdapter } from '../adapters/base.js';

export interface DispatchResult {
  statusCode: number;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array> | string;
  isStream: boolean;
}

export class UpstreamDispatcher {
  async dispatch(
    payload: UpstreamPayload,
    adapter: BaseAdapter,
    onChunk?: (delta: string) => void
  ): Promise<DispatchResult> {
    const response = await fetch(payload.url, {
      method: 'POST',
      headers: payload.headers,
      body: JSON.stringify(payload.body),
    });

    const isStream = Boolean(
      payload.body.stream ||
      response.headers.get('content-type')?.includes('text/event-stream')
    );

    const resHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    if (isStream && response.body) {
      const originalStream = response.body;
      const [streamForClient, streamForInspection] = originalStream.tee();

      // Background stream reader to capture text deltas
      (async () => {
        const reader = streamForInspection.getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const textChunk = decoder.decode(value, { stream: true });
            const delta = adapter.extractStreamDelta(textChunk);
            if (delta && onChunk) {
              onChunk(delta);
            }
          }
        } catch {
          // Stream read completed or cancelled
        }
      })();

      return {
        statusCode: response.status,
        headers: resHeaders,
        body: streamForClient,
        isStream: true,
      };
    } else {
      const text = await response.text();
      return {
        statusCode: response.status,
        headers: resHeaders,
        body: text,
        isStream: false,
      };
    }
  }
}
