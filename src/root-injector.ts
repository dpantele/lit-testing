import {
  Context,
  ContextEvent,
  ContextRoot,
} from '@lit/context';
import {
  providerRegistry,
  Provider,
  Token,
  DestroyRef,
} from './provider-registry.js';
import {ValueNotifier} from './value-notifier.js';

/** Root injector for Lit-DI. */
export class RootInjector extends ContextRoot {
  private host: HTMLElement;
  private providers = new Map<Token<unknown>, Provider<unknown>>();
  private instances = new Map<Token<unknown>, unknown>();
  private notifiers = new Map<Token<unknown>, ValueNotifier<unknown>>();
  private dependents = new Map<Token<unknown>, Set<Token<unknown>>>();
  private dependencies = new Map<Token<unknown>, Set<Token<unknown>>>();
  private subscriberCounts = new Map<Token<unknown>, number>();
  private destroyRef = new DestroyRef();
  private localTokens = new Set<Token<unknown>>();

  constructor(host: HTMLElement, providers: Provider[] = []) {
    super();
    this.host = host;

    for (const [token, provider] of providerRegistry.entries()) {
      this.providers.set(token as Token<unknown>, provider as Provider<unknown>);
      this.notifiers.set(token as Token<unknown>, new ValueNotifier<unknown>());
    }
    for (const p of providers) {
      this.providers.set(p.token as Token<unknown>, p as Provider<unknown>);
      this.localTokens.add(p.token as Token<unknown>);
      this.notifiers.set(p.token as Token<unknown>, new ValueNotifier<unknown>());
    }

    providerRegistry.onNew(p => {
      if (this.localTokens.has(p.token as Token<unknown>)) {
        return;
      }
      this.providers.set(p.token as Token<unknown>, p as Provider<unknown>);
      if (!this.notifiers.has(p.token as Token<unknown>)) {
        this.notifiers.set(p.token as Token<unknown>, new ValueNotifier<unknown>());
      }
      this.invalidateToken(p.token as Token<unknown>);
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
    const notifier = this.ensureNotifier(token);
    const host = (e.contextTarget ?? e.composedPath()[0]) as Element;
    const callback = e.callback as (v: unknown, u?: () => void) => void;
    const add = () => {
      if (e.subscribe) {
        this.subscriberCounts.set(
          token,
          (this.subscriberCounts.get(token) ?? 0) + 1
        );
        notifier.addCallback((v, unsub) => {
          const dispose = () => {
            unsub?.();
            const count = this.subscriberCounts.get(token)! - 1;
            if (count <= 0) {
              this.subscriberCounts.delete(token);
            } else {
              this.subscriberCounts.set(token, count);
            }
          };
          callback(v, dispose);
        }, host, true);
      } else {
        notifier.addCallback(callback, host, false);
      }
    };
    if (result instanceof Promise) {
      result.then(add);
    } else {
      add();
    }
  };

  private resolve<T>(token: Token<T>, provider: Provider<T>): T | Promise<T> {
    const cached = this.instances.get(token);
    if (cached !== undefined) {
      return cached as T | Promise<T>;
    }
    const result = this.compute(token, provider);
    if (result instanceof Promise) {
      const promise = result.then(v => {
        this.instances.set(token, v);
        this.ensureNotifier(token).setValue(v, true);
        this.notifyDependents(token);
        return v;
      });
      this.instances.set(token, promise);
      return promise;
    }
    this.instances.set(token, result);
    this.ensureNotifier(token).setValue(result, true);
    this.notifyDependents(token);
    return result;
  }

  private compute<T>(token: Token<T>, provider: Provider<T>): T | Promise<T> {
    if (provider.value !== undefined) {
      return provider.value as T;
    }
    if (!provider.factory) {
      throw new Error('Provider missing value or factory');
    }

    const deps = provider.deps ?? [];
    const depTokens = new Set<Token<unknown>>();
    for (const dep of deps) {
      depTokens.add(dep.token as Token<unknown>);
      let set = this.dependents.get(dep.token as Token<unknown>);
      if (!set) {
        this.dependents.set(dep.token as Token<unknown>, (set = new Set()));
      }
      set.add(token as Token<unknown>);
    }
    this.dependencies.set(token as Token<unknown>, depTokens);

    const inject = async <U>(tok: Token<U>): Promise<U> => {
      const prov = this.providers.get(tok);
      if (!prov) {
        throw new Error('missing provider');
      }
      return (await this.resolve(tok, prov)) as U;
    };
    const injectOptional = async <U>(tok: Token<U>): Promise<U | undefined> => {
      const prov = this.providers.get(tok);
      if (!prov) {
        return undefined;
      }
      return (await this.resolve(tok, prov)) as U;
    };

    let async = false;
    const depPromises: Promise<unknown>[] = [];
    for (const dep of deps) {
      const prov = this.providers.get(dep.token as Token<unknown>);
      if (!prov) {
        if (!dep.optional) {
          return Promise.reject(new Error('missing provider'));
        }
        continue;
      }
      const r = this.resolve(dep.token as Token<unknown>, prov as Provider<unknown>);
      if (r instanceof Promise) {
        async = true;
        depPromises.push(r);
      }
    }

    const runFactory = () =>
      provider.factory!({
        inject,
        injectOptional,
        injectSync: () => {
          throw new Error('injectSync not implemented');
        },
      });

    if (async) {
      return Promise.all(depPromises).then(() => runFactory()) as Promise<T>;
    }
    return runFactory() as T;
  }

  private ensureNotifier(token: Token<unknown>): ValueNotifier<unknown> {
    let n = this.notifiers.get(token);
    if (!n) {
      n = new ValueNotifier<unknown>();
      this.notifiers.set(token, n);
    }
    return n;
  }

  private notifyDependents(token: Token<unknown>): void {
    const deps = this.dependents.get(token);
    if (!deps) {
      return;
    }
    for (const dependent of deps) {
      const count = this.subscriberCounts.get(dependent) ?? 0;
      if (count === 0) {
        continue;
      }
      this.instances.delete(dependent);
      const prov = this.providers.get(dependent);
      if (prov) {
        this.resolve(dependent, prov);
      }
    }
  }

  private invalidateToken(token: Token<unknown>): void {
    this.instances.delete(token);
    const prov = this.providers.get(token);
    if (!prov) {
      return;
    }
    const count = this.subscriberCounts.get(token) ?? 0;
    if (count > 0) {
      this.resolve(token as Token<unknown>, prov as Provider<unknown>);
    }
    this.notifyDependents(token);
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
    for (const notifier of this.notifiers.values()) {
      notifier.clearCallbacks();
    }
    this.notifiers.clear();
    this.dependents.clear();
    this.dependencies.clear();
    this.host.removeEventListener('context-request', this.handleRequest as EventListener);
    this.detach(this.host);
    this.destroyRef.destroy();
  }
}

