import {assert} from '@open-wc/testing';
import {DestroyRef, DESTROY_REF} from '../provider-registry.js';

console.log('destroy-ref test loaded');

suite('DestroyRef', () => {
  test('runs callbacks on destroy', () => {
    const dr = new DestroyRef();
    let called = 0;
    dr.onDestroy(() => {
      called++;
    });
    dr.onDestroy(() => {
      called++;
    });

    dr.destroy();

    assert.equal(called, 2);
  });

  test('exports DESTROY_REF token', () => {
    assert.ok(DESTROY_REF);
  });
});
