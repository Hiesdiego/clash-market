// No-op replacement for the `server-only` package when running under
// the worker. The real package throws on import outside Next.js's
// server context; here we just want the import to succeed.
export {};
