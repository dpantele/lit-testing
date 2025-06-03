import {assert} from '@open-wc/testing';
import {createContext, ContextEvent} from '@lit/context';
import {RootInjector} from '../root-injector.js';
import {providerRegistry, Provider} from '../provider-registry.js';

suite('RootInjector', () => {
  test('resolves value provider from registry', () => {
    const token = createContext<number>(Symbol('num'));
    const provider: Provider<number> = {token, value: 42};
    providerRegistry.register(provider as any);
    const host = document.createElement('div');
    const injector = new RootInjector(host);
    let result: number | undefined;
    host.dispatchEvent(new ContextEvent(token, host, (v: number) => (result = v)));
    assert.equal(result, 42);
    injector.disposeAll();
  });

  test('caches factory result', () => {
    const token = createContext<number>(Symbol('num2'));
    let calls = 0;
    const provider: Provider<number> = {
      token,
      factory: () => {
        calls++;
        return 7;
      },
    };
    providerRegistry.register(provider as any);
    const host = document.createElement('div');
    const injector = new RootInjector(host);
    let v1: number | undefined;
    host.dispatchEvent(new ContextEvent(token, host, (v: number) => (v1 = v)));
    let v2: number | undefined;
    host.dispatchEvent(new ContextEvent(token, host, (v: number) => (v2 = v)));
    assert.equal(calls, 1);
    assert.equal(v1, 7);
    assert.equal(v2, 7);
    injector.disposeAll();
  });

  test('disposeAll calls provider dispose', () => {
    const token = createContext<number>(Symbol('num3'));
    let disposed = false;
    const provider: Provider<number> = {
      token,
      value: 1,
      dispose: () => {
        disposed = true;
      },
    };
    providerRegistry.register(provider as any);
    const host = document.createElement('div');
    const injector = new RootInjector(host);
    host.dispatchEvent(new ContextEvent(token, host, () => {}));
    injector.disposeAll();
    assert.isTrue(disposed);
  });

  test('registry onNew does not override constructor provider', () => {
    const token = createContext<number>(Symbol('num4'));
    const localProvider: Provider<number> = {token, value: 5};
    const host = document.createElement('div');
    const injector = new RootInjector(host, [localProvider as any]);
    const globalProvider: Provider<number> = {token, value: 9};
    providerRegistry.register(globalProvider as any);
    let result: number | undefined;
    host.dispatchEvent(new ContextEvent(token, host, v => (result = v)));
    assert.equal(result, 5);
    injector.disposeAll();
  });

  test('inject resolves declared dependency', async () => {
    const dep = createContext<number>(Symbol('dep-success'));
    const tok = createContext<number>(Symbol('tok-success'));
    const depProvider: Provider<number> = {token: dep, value: 2};
    providerRegistry.register(depProvider as any);
    const provider: Provider<number> = {
      token: tok,
      deps: [{token: dep}],
      factory: async ({inject}) => (await inject(dep)) + 1,
    };
    const host = document.createElement('div');
    const injector = new RootInjector(host, [provider as any]);
    let value: number | undefined;
    host.dispatchEvent(new ContextEvent(tok, host, v => (value = v)));
    await new Promise(r => setTimeout(r));
    assert.equal(value, 3);
    injector.disposeAll();
  });

  test('required dep missing rejects', async () => {
    const dep = createContext<number>(Symbol('dep'));
    const tok = createContext<number>(Symbol('tok'));
    const provider: Provider<number> = {
      token: tok,
      deps: [{token: dep}],
      factory: async ({inject}) => inject(dep),
    };
    const host = document.createElement('div');
    const injector = new RootInjector(host, [provider as any]);
    let threw = false;
    try {
      await (injector as any).resolve(tok, provider);
    } catch (e) {
      threw = true;
    }
    assert.isTrue(threw);
    injector.disposeAll();
  });

  test('optional dep missing returns undefined', () => {
    const dep = createContext<number>(Symbol('dep2'));
    const tok = createContext<number | undefined>(Symbol('tok2'));
    const provider: Provider<number | undefined> = {
      token: tok,
      deps: [{token: dep, optional: true}],
      factory: async ({injectOptional}) => injectOptional(dep),
    };
    const host = document.createElement('div');
    const injector = new RootInjector(host, [provider as any]);
    let value: number | undefined;
    host.dispatchEvent(new ContextEvent(tok, host, v => (value = v)));
    assert.isUndefined(value);
    injector.disposeAll();
  });

  test('dep update reruns factory for subscribers', async () => {
    const dep = createContext<number>(Symbol('dep3'));
    const tok = createContext<number>(Symbol('tok3'));
    const providerA: Provider<number> = {
      token: tok,
      deps: [{token: dep}],
      factory: async ({inject}) => (await inject(dep)) + 1,
    };
    const providerB: Provider<number> = {token: dep, value: 1};
    providerRegistry.register(providerB as any);
    const host = document.createElement('div');
    const injector = new RootInjector(host, [providerA as any]);
    const results: number[] = [];
    host.dispatchEvent(new ContextEvent(tok, host, v => results.push(v), true));
    await new Promise(r => setTimeout(r));
    assert.equal(results[0], 2);
    providerRegistry.register({token: dep, value: 3} as any);
    await new Promise(r => setTimeout(r));
    assert.equal(results[1], 4);
    injector.disposeAll();
  });
});
