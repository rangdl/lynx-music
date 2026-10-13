# AGENTS.md

You are an expert in TypeScript, ReactLynx, Rspeedy, and Lynx application development. You write maintainable, performant, and accessible code for this music player project.

## Read in Advance

- **Lynx**: [llms.txt](https://lynxjs.org/next/llms.txt) — **REQUIRED** before any Lynx task. It is the entry point to all Lynx docs.
- Project architecture: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — layering rules below assume you have read it.
- Lynx best practices: [ReactLynx Best Practices](https://lynxjs.org/next/react/best-practices.md) when touching dual-thread behavior.

## Commands

- `npm run dev` — dev server (port 3090; scan QR with LynxExplorer for device preview)
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run test` — Rstest

## Project Overview

Cross-platform music player built with ReactLynx. Its differentiating feature is running **untrusted lx music-source scripts** to resolve stream URLs. Layers (see architecture doc for detail):

```
ui  ←  state (Zustand)  ←  services  ←  runtime (lx sandbox) / platform (host adapters)
```

## Layering Rules (strict)

- `ui/` must not import from `services/`, `runtime/`, or `platform/`. It reads state via store hooks and raises events via props.
- `state/` stores hold **serializable state only**. Heavy handles (audio instances, script contexts) live in service singletons; stores keep ids.
- `services/` never touches `NativeModules`, `lynx.__globalProps`, or `window` directly — that is `platform/`'s exclusive job. `services/` also never imports `ui/`.
- `runtime/` (lx script sandbox + bridge) is called only by `services/source/`. Nothing else may know scripts exist.
- Dependencies point downward only. A violation is a bug, even if it works.

## Lynx-Specific Constraints (hard rules)

These were confirmed by measurement or by docs. Do not re-litigate them in code:

1. **No DOM/browser globals** in shared code. No `window`, `document`, `matchMedia`. Host differences go through `platform/`.
2. **`'background only';` directive** must be the first statement of every event handler, effect, and custom-hook-created callback that is not a function component. Framework inference stops at indirection.
3. **No `useLayoutEffect`**. Use `bindlayoutchange` / `main-thread:bindlayoutchange` or `useMainThreadRef`.
4. **Cross-thread calls** only via `runOnMainThread`/`runOnBackground` with JSON-serializable args. `'main thread';` functions cannot capture non-serializable values.
5. **Text only inside `<text>`**; scrolling only via `<scroll-view>` / `<list>`; every element is block-ish (`display: linear` default differences from web apply).
6. **`'background only';`-adjacent syntax limits**: background thread is ES2015, main thread ES2019 — the build transpiles; just never hand-write newer syntax inside string-embedded code.
7. **Theming**: theme is a **JS single source of truth** (`useTheme`), applied via `.theme-light/.theme-dark` classes + CSS variables. Do NOT use `@media (prefers-color-scheme)` (stripped by the web build), CSS `var()` inside SVG attributes (x-svg renders via `<img>`, can't see page variables), or `matchMedia` (undefined on the background thread). Icon colors resolve to concrete values via `Icon` + `resolveColor`.
8. **CSS**: `box-sizing: border-box` always; no margin collapsing; CSS inheritance is opt-in. Relative/z-index quirk: a parent whose children use `z-index` must itself set `z-index: 0` or higher. **Web build crash trap (measured 2026-10): adding a brand-new CSS custom property name to `.theme-*` blocks crashes the web build** (`web-core` `encodeCSS` throws "Cannot read properties of undefined (reading 'toArray')") — the lynx build still succeeds, so check the web target. New theme tokens must be added to the JS `TONES` map in `ui/theme/useTheme.ts` and referenced there, not invented purely in CSS.
9. **Fetch/encoding**: no `TextEncoder`/`TextDecoder` in PrimJS (measured on device: "Can't find variable: TextDecoder") — use `utf8Decode` from `platform/index.ts` for bytes→text; never construct `TextDecoder` directly. Binary HTTP bodies arrive as `Uint8Array` (see `httpRequest`).
10. **High-frequency UI** (drag, progress-follow): use `main-thread:` events + `MainThread.Element.setStyleProperty`, not background-thread state at high frequency.
11. **Event handlers**: pass function references, not inline arrow functions (`bindtap={handleTap}` not `bindtap={() => ...}`); prefer `data-*`/`dataset` over closures for passing data; use `catchtap` only to stop propagation.
12. **Hoist static JSX** outside component functions (especially large SVG nodes) — they are recreated every render otherwise. (React Compiler would do this automatically if enabled.)
13. **Routing**: React Router only at **v6** (ReactLynx supports React 17 APIs only). No `<Link>`/`<NavLink>` — navigate via `useNavigate`.
14. **Prefer `@lynx-js/lynx-ui` components** (Switch, Input, Dialog, Sheet, Swiper…) over hand-rolled ones; hand-roll only when lynx-ui lacks the capability or conflicts with the design.
15. **Server data** (library sync, lyrics, covers) uses **TanStack Query** on top of `platform/http`; hand-rolled caching only in the lx source-resolution path.

## lx Script Runtime Rules

- User scripts are **untrusted**. They execute only through `runtime/sandbox.ts` with the injected `lx` API object — never with real `NativeModules`, storage, or DOM access.
- All script network traffic goes through `runtime/api/http.ts` (which delegates to `platform/http`) so timeouts, logging, and rate limits stay enforceable.
- `runtime/bridge.ts` exposes Promise-based APIs with timeout + cancellation + error classification. Callers never see script internals.
- New scripts must pass: eval → structure check (`musicSources` present) → health check (resolve one test URL) before entering the enabled registry.
- Bugs in a script must degrade to "try next source", never crash the player.

## Code Style

- TypeScript everywhere; strict. Shared types live next to their layer (`runtime/types.ts`, `services/*/types.ts`), not in a global `types.ts` dump.
- File naming: `PascalCase.tsx` for components/pages, `camelCase.ts` for everything else. Imports use explicit `.js` extensions (current convention).
- Chinese comments for design decisions/why (the existing codebase convention); code identifiers in English.
- Components: small, prop-typed, no default exports for components. Data-driven rendering (see `data/settings.ts` pattern) preferred over hand-listed JSX.
- No `any` without a comment explaining why. Prefer `unknown` + narrowing.
- Color/design tokens: single source in `ui/theme/tokens.ts`. Never hardcode hex values in components; semantic tones only.

## Testing

- `runtime/` and `services/` layers must have unit tests (pure TS + fake platform, no device needed).
- UI changes need at least a render smoke test (`@lynx-js/react/testing-library`, config in `rstest.config.ts`).
- Manual device checklist for `platform/` changes: theme switch, safe area, audio playback on both Web preview and LynxExplorer.

## Definition of Done for a Task

1. `npm run test` and `npm run build` both pass.
2. New platform/host-dependent code has a Web fallback path.
3. Comments record any measured Lynx behavior you discovered (so future agents don't re-derive it).

## Known Platform Limitations (measured)

- **Web preview has no audio playback path**: the ReactLynx app logic runs in a web worker (no `document`) on the web target, so `platform/audio.ts`'s `<audio>` fallback cannot create elements from the background context — playback correctly degrades to an error message ("当前环境不支持 Web 音频播放"). Real devices use `NativeModules.Audio` (main-thread native). A dedicated host bridge will be needed if browser playback is ever required.
- **`x-input` collapses newlines**: single-line `<input>` turns pasted multi-line text's `\n` into spaces — always use `<textarea>` for script/code input (this broke `@name` header parsing during script install).
- **`localStorage` is unavailable in the web-preview sandbox iframe** (`about:srcdoc`, opaque origin): `platform/storage.ts` keeps an in-memory fallback map; persistence across reloads works in real browsers and on device.
