import {Context, ContextEvent, ContextRoot} from '@lit/context';
import {providerRegistry, Provider, Token, DestroyRef} from './provider-registry.js';

/** Root injector for Lit-DI. */
export class RootInjector extends ContextRoot {
  private host: HTMLElement;
  private providers = new Map<Token<unknown>, Provider<unknown>>();
  private instances = new Map<Token<unknown>, unknown>();
  private destroyRef = new DestroyRef();
  private localTokens = new Set<Token<unknown>>();

  constructor(host: HTMLElement, providers: Provider[] = []) {
    super();
    this.host = host;

    for (const [token, provider] of providerRegistry.entries()) {
      this.providers.set(token as Token<unknown>, provider as Provider<unknown>);
    }
    for (const p of providers) {
      this.providers.set(p.token as Token<unknown>, p as Provider<unknown>);
      this.localTokens.add(p.token as Token<unknown>);
    }

    providerRegistry.onNew(p => {
      if (this.localTokens.has(p.token as Token<unknown>)) {
        return;
      }
      this.providers.set(p.token as Token<unknown>, p as Provider<unknown>);
    });

    this.attach(host);
    host.addEventListener('context-request', this.handleRequest as EventListener);
  }

  private handleRequest = (event: Event): void => {
    const e = event as ContextEvent<Context<unknown, unknown>>;
    const token = e.context as Token<unknown>;
    const provider = this.providers.get(token);
    if (!provider) {
      return;
    }
    e.stopPropagation();
    const result = this.resolve(token, provider);
    if (result instanceof Promise) {
      result.then(v => e.callback(v as unknown));
    } else {
      e.callback(result as unknown);
    }
  }

  private resolve<T>(token: Token<T>, provider: Provider<T>): T | Promise<T> {
    if (this.instances.has(token)) {
      return this.instances.get(token) as T;
    }
    let value: T | Promise<T>;
    if (provider.value !== undefined) {
      value = provider.value as T;
    } else if (provider.factory) {
      value = provider.factory({
        inject: async () => {
          throw new Error('inject not implemented');
        },
        injectOptional: async () => undefined,
        injectSync: () => {
          throw new Error('injectSync not implemented');
        },
      }) as T | Promise<T>;
    } else {
      throw new Error('Provider missing value or factory');
    }
    if (value instanceof Promise) {
      return value.then(v => {
        this.instances.set(token, v);
        return v;
      });
    }
    this.instances.set(token, value as T);
    return value as T;
  }

  /** Dispose all provider instances and detach listeners. */
  disposeAll(): void {
    for (const [token, instance] of this.instances) {
      const provider = this.providers.get(token);
      if (provider?.dispose) {
        provider.dispose(instance as unknown);
      }
    }
    this.instances.clear();
    this.host.removeEventListener('context-request', this.handleRequest as EventListener);
    this.detach(this.host);
    this.destroyRef.destroy();
  }
}

