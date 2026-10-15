// Polyfills the shared web code needs. Imported first by index.ts.
if (typeof globalThis.structuredClone !== 'function') {
  // the league is plain JSON (it is saved as JSON), so a JSON round-trip is a faithful clone
  globalThis.structuredClone = (<T>(v: T): T => JSON.parse(JSON.stringify(v))) as typeof structuredClone
}
