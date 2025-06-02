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
});
