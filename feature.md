# Lit Dependency‑Injection Final Specification

**Date:** 2025‑06‑01    **Audience:** Lit library authors & application developers

---

## Table of Contents

1. Overview
2. Core APIs
3. Lifecycle & DestroyRef
4. Injector Types
5. Factory Semantics
6. Global ProviderRegistry
7. Override & Refresh Logic
8. Step‑by‑Step Implementation Plan (P1 → P9)
9. Phase Details & Acceptance Tests
10. Style‑Guide Checklist

---

## 1 — Overview

Lit‑DI delivers Angular‑style hierarchical injection using **@lit/context** alone—no custom decorators, minimal runtime, fully tree‑shakable. Each Lit component subtree gets its own **RootInjector**; child components add **ChildInjectorControllers** to override services. A singleton **ProviderRegistry** lets libraries auto‑register providers so application authors rarely touch injector wiring.

Styleguide is available in styleguide.html. Special and important rule: only basic Lit's decorators are allowed, no other decorators could be used.

Lit context docs:
[https://github.com/lit/lit/blob/main/packages/context/README.md](https://github.com/lit/lit/blob/main/packages/context/README.md)
[https://github.com/lit/lit/blob/main/packages/context/src](https://github.com/lit/lit/blob/main/packages/context/src) is implementation

---

## 2 — Core APIs

```ts
import {Context, createContext} from '@lit/context';

export type Token<T> = Context<T>;

/** Destroy‑ref token */
export const DESTROY_REF: Token<DestroyRef> = createContext<DestroyRef>(Symbol('DestroyRef'));

export interface Dep<T> {
  token: Token<T>;         // DI key
  optional?: boolean;      // false ⇒ throw if missing
}

export interface Provider<T = unknown> {
  token: Token<T>;
  value?: T;               // constant instance
  deps?: Dep<any>[];       // for injectSync + re‑run graph
  factory?: (helpers: {
    inject: <U>(tok: Token<U>) => Promise<U>;
    injectOptional: <U>(tok: Token<U>) => Promise<U | undefined>;
    injectSync: <U>(tok: Token<U>) => U;  // throws if not ready/declared
    destroyRef?: DestroyRef;             // present only if requested
  }) => Promise<T>|T;
  dispose?: (instance: T) => void;
}
```

---

## 3 — Lifecycle & DestroyRef

`DestroyRef` encapsulates teardown callbacks. Inject it like any other token:

```ts
factory: ({inject, destroyRef}) => {
  const conn = new WebSocket('wss://');
  destroyRef!.onDestroy(() => conn.close());
  return conn;
}
```

*RootInjector* disposes its global DestroyRef in `disposeAll()`. Each provider instance gets its **own** DestroyRef when it calls `inject(DESTROY_REF)`—scoped disposal.

---

## 4 — Injector Types

| Injector                    | Scope            | Provides                        | Comment                                  |
| --------------------------- | ---------------- | ------------------------------- | ---------------------------------------- |
| **RootInjector**            | Lit subtree root | Registry providers + local list | Extends `ContextRoot`; no parents        |
| **ChildInjectorController** | Host element     | Overrides / adds providers      | Uses hidden `di-scope` + ContextProvider |

---

## 5 — Factory Semantics

1. Declared `deps` are resolved first.
2. Helpers object is built:

   * `inject`, `injectOptional` always available.
   * `injectSync` allowed **only** for tokens present in `deps`; throws otherwise.
   * `destroyRef` included **iff** factory requested `DESTROY_REF` (by deps or via inject).
3. If *all* deps are cached → factory executes within same micro‑task; else awaits.
4. Injector records dependency tokens; when any of them change and consumer is subscribed, injector:

   * Runs `dispose` & DestroyRef
   * Re‑executes factory (step 1)
   * Emits updated value to consumers.

---

## 6 — Global ProviderRegistry

```ts
class ProviderRegistry {
  private map = new Map<Token<unknown>, Provider>();
  private listeners = new Set<(p:Provider)=>void>();
  register(...p:Provider[]) { p.forEach(x=>{this.map.set(x.token,x); this.listeners.forEach(cb=>cb(x));}); }
  entries() {return this.map.entries();}
  onNew(cb:(p:Provider)=>void){this.listeners.add(cb);} }
```

Late‑registered providers flow to existing RootInjectors via `onNew` callback.

---

## 7 — Override / Refresh Algorithm

Child injector registering a token already satisfied deeper in tree must cause subscribed consumers to switch:

1. ChildInjector emits `context-refresh` with detail `{token}`.
2. RootInjector catches event; re‑dispatches `context-request` from each subscribed consumer in that subtree.
3. New nearer provider responds; Lit updates.
   Read‑once consumers (`subscribe:false`) ignore refresh.

---

## 8 — Implementation Roadmap

| Phase  | Title                   | Outcome                                                            |
| ------ | ----------------------- | ------------------------------------------------------------------ |
| **P1** | ProviderRegistry        | Singleton + late load events                                       |
| **P2** | DestroyRef              | Class + DESTROY\_REF token handling                                |
| **P3** | RootInjector core       | Resolve/cache/attach; no deps yet                                  |
| **P4** | Dependency Wiring       | Implement `deps`, `inject`, `injectOptional`; re‑run on dep change |
| **P5** | injectSync              | Fast synchronous path + constructor‑time availability test         |
| **P6** | ChildInjectorController | ContextProvider wrapper + scope disposal                           |
| **P7** | Override Refresh        | context-refresh replay logic                                       |
| **P8** | Cycle Detection         | Creation stack guard                                               |
| **P9** | Docs & Samples          | Guide, recipes, API refs                                           |

---

## 9 — Phase Details & Acceptance Tests

### P4 Tests

1. **Required dep missing** → factory promise rejects.
2. **Optional dep missing** → factory receives `undefined`.
3. **Dep update** → consumer property getter called with new instance.

### P5 Tests

1. Parent service already cached; child provider factory uses `injectSync` in constructor — value available before first `update()`.
2. Attempt `injectSync` for undeclared token → throws.

### P7 Tests

1. Late upgrade scenario (`<cp>` → `<cp2>`) switches consumer instance.
2. Read‑once consumer remains on original instance.

### P8 Tests

1. Circular Provider A → B → A throws descriptive error.

---

## 10 — Style‑Guide Checklist

* All code UTF‑8, single‑quotes.
* No `#private`; prefer `private`/`protected` keywords.
* Named exports only.
* Doc each exported symbol with `/** … */`.