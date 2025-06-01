import {Context} from '@lit/context';

export type Token<T> = Context<unknown, T>;

export interface Dep<T> {
  token: Token<T>;
  optional?: boolean;
}

export interface Provider<T = unknown> {
  token: Token<T>;
  value?: T;
  deps?: Dep<unknown>[];
  factory?: (helpers: {
    inject: <U>(tok: Token<U>) => Promise<U>;
    injectOptional: <U>(tok: Token<U>) => Promise<U | undefined>;
    injectSync: <U>(tok: Token<U>) => U;
    destroyRef?: DestroyRef;
  }) => Promise<T> | T;
  dispose?: (instance: T) => void;
}

export interface DestroyRef {
  onDestroy(cb: () => void): void;
}

/**
 * Global registry for DI providers.
 */
export type AnyProvider = Provider<unknown>;

export class ProviderRegistry {
  private map = new Map<Token<unknown>, AnyProvider>();
  private listeners = new Set<(p: AnyProvider) => void>();

  register(...providers: AnyProvider[]) {
    for (const provider of providers) {
      this.map.set(provider.token, provider);
      for (const cb of this.listeners) {
        cb(provider);
      }
    }
  }

  entries() {
    return this.map.entries();
  }

  onNew(cb: (p: AnyProvider) => void) {
    this.listeners.add(cb);
  }
}

export const providerRegistry = new ProviderRegistry();
