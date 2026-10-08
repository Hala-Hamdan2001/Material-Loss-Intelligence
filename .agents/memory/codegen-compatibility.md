---
name: Code generation compatibility
description: Non-obvious workspace code generation and browser typing constraints.
---
Generating separate TypeScript schemas alongside Orval Zod validators can collide when an operation has both path and query parameters; both may export an operation-prefixed Params symbol.

**Why:** Code generation succeeded but the generated barrel then failed TypeScript compilation.

**How to apply:** Keep the Zod package validator-focused and derive server types from validators; client entity types remain in the client package. Do not manually repair generated barrels, because codegen rewrites them.

The generated fetch client uses Headers.entries, which requires dom.iterable in addition to dom.

**Why:** DOM alone lacks the iterable Headers API in TypeScript.

**How to apply:** Preserve iterable DOM typings when changing shared client build configuration.
