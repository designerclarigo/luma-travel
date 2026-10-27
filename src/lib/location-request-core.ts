type JsonResponse = { ok: boolean; status: number; json: () => Promise<unknown> };
type JsonFetch = (url: string, options: { signal: AbortSignal; headers: { Accept: string } }) => Promise<JsonResponse>;
type NativeRequest = (url: string, signal?: AbortSignal) => Promise<unknown>;

export class LocationHttpError extends Error {
  constructor(public status: number) {
    super(status === 429 ? 'The provider is busy. Please wait before trying again.' : `Location search is unavailable (${status}). Please try again.`);
  }
}
const cancelled = () => new Error('Location search was cancelled.');

/** A deadline also settles a stalled body reader or a transport that ignores abort. */
export function createLocationRequester(fetcher: JsonFetch, nativeFallback?: NativeRequest, timeoutMs = 8000) {
  return async (url: string, signal?: AbortSignal): Promise<unknown> => {
    if (signal?.aborted) throw cancelled();
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let cancelRequest: (() => void) | undefined;
    try {
      const limit = new Promise<never>((_, reject) => {
        deadline = setTimeout(() => { controller.abort(); reject(new Error('Location request timed out.')); }, timeoutMs);
        cancelRequest = () => { controller.abort(); reject(cancelled()); };
        signal?.addEventListener('abort', cancelRequest, { once: true });
      });
      const request = (async () => {
        const response = await fetcher(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new LocationHttpError(response.status);
        return response.json();
      })();
      return await Promise.race([request, limit]);
    } catch (error) {
      if (signal?.aborted) throw cancelled();
      if (error instanceof LocationHttpError) throw error; // Do not retry rate limits or other HTTP errors.
      // Expo's streaming fetch and RN's native XHR use different response readers.
      // Retry only a transport/body failure, once, through the native JSON reader.
      if (nativeFallback) {
        try { return await nativeFallback(url, signal); }
        catch (fallbackError) {
          if (signal?.aborted) throw cancelled();
          if (fallbackError instanceof LocationHttpError) throw fallbackError;
        }
      }
      throw new Error('Couldn’t reach location search. Check your connection and Expo Go’s internet access, then try again.');
    } finally {
      clearTimeout(deadline);
      if (cancelRequest) signal?.removeEventListener('abort', cancelRequest);
      controller.abort();
    }
  };
}

/** Public React Native XHR API; HTTPS and normal certificate validation stay enabled. */
export function createNativeLocationRequest(makeRequest: () => XMLHttpRequest, timeoutMs = 8000): NativeRequest {
  return (url, signal) => new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(cancelled()); return; }
    const request = makeRequest(); let settled = false;
    const finish = (error: Error | null, value?: unknown) => {
      if (settled) return; settled = true; clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      request.onload = request.onerror = request.ontimeout = request.onabort = null;
      if (error) reject(error); else resolve(value);
    };
    const abort = () => { finish(cancelled()); request.abort(); };
    // A JS deadline covers native implementations that fail to emit ontimeout.
    const timer = setTimeout(() => { finish(new Error('Location request timed out.')); request.abort(); }, timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      request.open('GET', url, true); request.timeout = timeoutMs;
      request.setRequestHeader('Accept', 'application/json');
      request.onload = () => {
        if (request.status < 200 || request.status >= 300) { finish(new LocationHttpError(request.status)); return; }
        try { finish(null, JSON.parse(request.responseText)); } catch { finish(new Error('The location response was incomplete. Please try again.')); }
      };
      request.onerror = () => finish(new Error('Location network request failed.'));
      request.ontimeout = () => finish(new Error('Location request timed out.'));
      request.onabort = () => finish(cancelled());
      request.send();
    } catch (error) { finish(error instanceof Error ? error : new Error('Location request failed.')); }
  });
}
