/** A deadline never turns an unfinished operation into success. Late results are discarded. */
export function withDeadline<T>(work: PromiseLike<T>, milliseconds: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), milliseconds);
    Promise.resolve(work).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Bound both response headers and body; abort transport and discard late replies on timeout. */
export function createTimedFetch(fetcher: typeof fetch, milliseconds = 15000): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const upstream = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
    const cancel = () => controller.abort();
    if (upstream?.aborted) cancel();
    upstream?.addEventListener('abort', cancel, { once: true });
    try {
      const request = (async () => {
        const response = await fetcher(input, { ...init, signal: controller.signal });
        // Auth replies are small JSON documents. Buffering also bounds a stalled response body.
        const body = await response.text();
        return new Response([204, 205, 304].includes(response.status) || init?.method === 'HEAD' ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
      })();
      return await withDeadline(request, milliseconds, 'Account request timed out. Check your connection and try again.');
    } finally {
      controller.abort();
      upstream?.removeEventListener('abort', cancel);
    }
  };
}
