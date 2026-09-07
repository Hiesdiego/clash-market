// Alias `server-only` to a no-op so the worker (a plain Node process,
// not a Next.js server context) can import modules that use it as a
// build-time guard. Next.js itself still sees the real package via
// its own resolver, so the guard is preserved there.
// `new URL(..., import.meta.url)` already returns the file URL expected by
// the loader hook. `pathToFileURL` accepts filesystem paths, not URL objects.
const real = new URL("./server-only-shim-impl.mjs", import.meta.url).href;

// tsx can compile a bare `import "server-only"` into a CommonJS require.
// Node's ESM resolve hook does not intercept that path, so also cover the
// CommonJS loader while this preload is active.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  // tsx may pass either the package name or its resolved index.js path.
  if (
    request === "server-only" ||
    /[\\/]server-only[\\/]index\.js$/.test(request)
  ) {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: real, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
