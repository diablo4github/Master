/// <reference types="vite/client" />

// Vite parses JSON imports into a module object at build/dev time. tsconfig
// does not enable resolveJsonModule (and is frozen to this layer), so declare
// the module shape here for the asset manifests the renderer imports.
declare module '*.json' {
  const value: unknown;
  export default value;
}
