# Project **Agents.md** – TypeScript + Lit

This file tells OpenAI Codex (and any other AI agent) exactly **how to read, extend, and safeguard this code-base.**

---

## 1 · Directory map Codex must honour

| Path                     | Purpose & Mandatory Rules                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/src/`**              | All authored source code.                                                                                                                      |
|   `/<component>/`        | *One folder per component*, e.g. **`src/my-element/`**                                                                                         |
|     `my-element.ts`      | Implementation – a single Lit component exported via `@customElement`.                                                                         |
|     `my-element_test.ts` | Unit tests for that component (same folder, suffixed `_test.ts`).                                                                              |
| **`/dev/`**              | Local playground demos loaded by *web-dev-server*. Never bundled.                                                                              |
| **`/docs-src/`**         | Eleventy markdown/templates. Can be edited; output in `/docs/` is **read-only**.                                                               |
| **Config files**         | `rollup.config.js`, `web-dev-server.config.js`, `tsconfig.json`, ESLint/Prettier. Codex may touch these but must explain the change in the PR. |

> **Pattern:** `src/<tag-name>/<tag-name>.ts` + `<tag-name>_test.ts` keeps code and tests co-located yet bundled independently.

---

## 2 · Coding conventions

### 2.1 Language & tooling

* **TypeScript everywhere**.

  * `experimentalDecorators: true`, `useDefineForClassFields: false` in *tsconfig* (Lit decorators rely on this).([lit.dev][1])
* Follow ESLint rules (`plugin:lit/recommended`) and Prettier formatting.([Luis Aviles][2])

### 2.2 Component template

```ts
import {LitElement, html, css} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('my-element')
export class MyElement extends LitElement {
  @property({type: String}) name = 'World';

  static styles = css`
    :host {
      display: block;
      padding: 0.75rem;
      border: 1px solid #dadada;
      border-radius: 4px;
      font-family: system-ui, sans-serif;
    }
  `;                        /*  ← Vanilla CSS only */

  render() {
    return html`<h1>Hello, ${this.name}!</h1>`;
  }
}
```

* **No Tailwind or external CSS frameworks.** Styles live in the static `styles` property using standard CSS syntax.([20190613t124942-dot-polymer-lit-element.appspot.com][3])
* Class name is **PascalCase**; tag name is **kebab-case** (must contain a hyphen).
* Keep one responsibility per element; if `render()` exceeds ±120 LOC, split into sub-elements.

### 2.3 Events

* Use lower-case, hyphenated names (`item-added`).
* Document the `detail` payload in JSDoc; always bubble and be composed unless you have a reason not to.

---

## 3 · Testing framework & workflow

| Tool                 | Why we use it                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **@web/test-runner** | Runs tests in real browsers via ESM, speedy watch mode, built-in coverage.([Open Web Components][4], [Open Web Components][5]) |
| **@open-wc/testing** | Helper APIs (`fixture`, `expect`, `aTimeout`) that simplify Lit component tests.([Open Web Components][6])                     |
| **sinon**            | Spies/stubs; recommended by Open WC guides.([Open Web Components][7])                                                          |

#### Commands Codex must run

```bash
npm run test            # full run in Chrome, Firefox, WebKit
npm run test:watch      # re-run affected specs on change
npm run test:coverage   # Istanbul report – keep ≥ 90 %
```

A minimal test lives beside its component:

```ts
import {fixture, expect} from '@open-wc/testing';
import '../my-element.js';             // compiled JS or TS path alias

suite('my-element', () => {
  test('is defined', () => {
    const el = document.createElement('my-element');
    expect(el).instanceOf(MyElement);
  });

  test('greets by default', async () => {
    const el = await fixture<MyElement>(html`<my-element></my-element>`);
    expect(el.shadowRoot!.textContent).to.include('Hello, World!');
  });
});
```

---

## 4 · Quality gates before merge

| Command              | Purpose                  |
| -------------------- | ------------------------ |
| `npm run lint`       | ESLint with Lit plugin   |
| `npm run type-check` | `tsc --noEmit`           |
| `npm run build`      | Rollup production bundle |

**All three must pass** for Codex to mark a PR as ready.

---

## 5 · Pull-request checklist

1. Explain *what* changed and *why*.
2. Link related issues.
3. All tests & gates green.
4. Provide screenshots or a `/dev/` demo link for UI changes.
5. Keep PRs atomic and under ±400 LOC when possible.

---

## 6 · Performance & deployment

* Bundle with **Rollup** using code-splitting and hashed filenames.
* Serve native ES 2017 modules; transpile a legacy build only when analytics demand.
* Minify with Terser; inline critical CSS where feasible.

[1]: https://lit.dev/docs/components/styles/?utm_source=chatgpt.com "Styles - Lit"
[2]: https://luixaviles.com/2021/05/share-styles-web-components-litelement-typescript/?utm_source=chatgpt.com "How to Share styles in Web Components with LitElement and ..."
[3]: https://20190613t124942-dot-polymer-lit-element.appspot.com/guide/styles?utm_source=chatgpt.com "Styles - LitElement"
[4]: https://open-wc.org/blog/testing-web-components-with-web-test-runner/?utm_source=chatgpt.com "Testing Web Components with @web/test-runner"
[5]: https://open-wc.org/guides/developing-components/testing/?utm_source=chatgpt.com "Developing Components: Testing"
[6]: https://open-wc.org/docs/testing/helpers/?utm_source=chatgpt.com "Testing: Helpers - Open Web Components"
[7]: https://open-wc.org/blog/testing-workflow-for-web-components/?utm_source=chatgpt.com "Testing Workflow for Web Components"
