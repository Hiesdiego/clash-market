import { fallback, http } from "viem";

/** Return non-empty, unique endpoints while preserving the configured order. */
export function uniqueRpcUrls(urls: readonly (string | undefined)[]): string[] {
  return [...new Set(urls.map((url) => url?.trim()).filter((url): url is string => Boolean(url)))];
}

/**
 * HTTP transport with endpoint failover. Viem retries the next transport when
 * the current endpoint cannot answer the request; ranking is enabled so a
 * recovered endpoint can become preferred again.
 */
export function createRpcFallbackTransport(urls: readonly (string | undefined)[]) {
  const endpoints = uniqueRpcUrls(urls);
  if (endpoints.length === 0) throw new Error("At least one RPC endpoint is required");
  return fallback(endpoints.map((url) => http(url, { retryCount: 0 })), { rank: true });
}

/**
 * The Markets SDK currently accepts one WebSocket URL. This proxy gives its
 * read paths a second chance on the configured fallback client. Writes are
 * deliberately not retried because a timeout can happen after a transaction
 * was already accepted by the chain.
 */
export function createReadFailover<T extends object>(clients: readonly T[]): T {
  if (clients.length === 0) throw new Error("At least one client is required");
  const firstClient = clients[0];
  if (!firstClient) throw new Error("At least one client is required");
  if (clients.length === 1) return firstClient;

  let active = 0;
  const nested = new Map<PropertyKey, unknown>();

  const isRead = (property: PropertyKey) => {
    if (typeof property !== "string") return false;
    return /^(load|fetch|get|list|watch|market|count|encode|quote|tryGet|is|meets|preview)/.test(property);
  };

  const invoke = (property: PropertyKey, args: unknown[], index: number): unknown => {
    const target = clients[index];
    if (!target) throw new Error("RPC failover client is unavailable");
    const method = Reflect.get(target, property, target);
    if (typeof method !== "function") return method;

    const retry = (error: unknown): unknown => {
      if (!isRead(property) || clients.length < 2 || index !== active) throw error;
      const next = (index + 1) % clients.length;
      active = next;
      return invoke(property, args, next);
    };

    try {
      const result = Reflect.apply(method, target, args);
      return result && typeof (result as PromiseLike<unknown>).then === "function"
        ? (result as PromiseLike<unknown>).then((value) => value, retry)
        : result;
    } catch (error) {
      return retry(error);
    }
  };

  return new Proxy(firstClient, {
    get(_target, property) {
      const target = clients[active];
      if (!target) throw new Error("RPC failover client is unavailable");
      const value = Reflect.get(target, property, target);

      // Keep signer changes and shutdown in sync across both SDK instances.
      if (property === "setSigner" || property === "close") {
        return (...args: unknown[]) => {
          let result: unknown;
          for (const client of clients) {
            const method = Reflect.get(client, property, client);
            if (typeof method === "function") result = Reflect.apply(method, client, args);
          }
          return result;
        };
      }

      // Methods must run with the real SDK instance as `this`. Returning the
      // raw function makes a call such as exchange.loadMarkets() use this
      // Proxy instead, which wraps the SDK's internal Maps and causes native
      // Map methods (for example Map.prototype.keys) to reject their receiver.
      if (typeof value === "function") {
        return (...args: unknown[]) => invoke(property, args, active);
      }

      if (typeof value !== "object" || value === null) return value;
      const cached = nested.get(property);
      if (cached) return cached;

      const childClients = clients.map((client) => Reflect.get(client, property, client));
      const child = createReadFailover(childClients as object[]) as T;
      nested.set(property, child);
      return child;
    },
    apply(_target, _thisArg, args) {
      return invoke("call", args, active);
    },
  });
}
