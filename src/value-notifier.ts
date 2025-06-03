export type Disposer = () => void;
export type Callback<T> = (value: T, disposer?: Disposer) => void;

export class ValueNotifier<T> {
  private subscriptions = new Map<Callback<T>, {disposer: Disposer}>();
  private _value!: T;

  constructor(defaultValue?: T) {
    if (defaultValue !== undefined) {
      this._value = defaultValue;
    }
  }

  get value(): T {
    return this._value;
  }

  setValue(v: T, force = false): void {
    const update = force || !Object.is(v, this._value);
    this._value = v;
    if (update) {
      this.updateObservers();
    }
  }

  addCallback(callback: Callback<T>, _host: Element, subscribe = false): void {
    if (!subscribe) {
      callback(this.value);
      return;
    }
    if (!this.subscriptions.has(callback)) {
      this.subscriptions.set(callback, {
        disposer: () => {
          this.subscriptions.delete(callback);
        },
      });
    }
    const {disposer} = this.subscriptions.get(callback)!;
    callback(this.value, disposer);
  }

  clearCallbacks(): void {
    this.subscriptions.clear();
  }

  private updateObservers(): void {
    for (const [cb, {disposer}] of this.subscriptions) {
      cb(this._value, disposer);
    }
  }
}
