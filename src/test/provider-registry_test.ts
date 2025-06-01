import {assert} from '@open-wc/testing';
import {createContext} from '@lit/context';
import {ProviderRegistry, AnyProvider} from '../provider-registry.js';

suite('ProviderRegistry', () => {
  test('register notifies listeners', () => {
    const registry = new ProviderRegistry();
    const token = createContext<number>(Symbol('num'));
    const provider: AnyProvider = {token, value: 42};
    let notified: AnyProvider | undefined;
    registry.onNew(p => {
      notified = p;
    });

    registry.register(provider);

    assert.strictEqual(notified, provider);
    const entry = Array.from(registry.entries()).find(([t]) => t === token);
    assert.ok(entry);
    assert.strictEqual(entry![1], provider);
  });
});
