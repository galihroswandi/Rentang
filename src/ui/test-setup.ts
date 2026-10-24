import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/svelte'
import { afterEach } from 'vitest'

// jsdom implements neither scrolling, ResizeObserver, matchMedia nor the Web Animations
// API that Svelte transitions use; these stand-ins let components mount and animate instantly.
Element.prototype.scrollTo = function scrollTo() {}
globalThis.ResizeObserver = class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
window.matchMedia = (query: string) =>
  ({
    matches: query.includes('reduce'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }) as MediaQueryList
Element.prototype.animate = function animate() {
  const animation = {
    finished: Promise.resolve(),
    onfinish: null as (() => void) | null,
    cancel() {},
    finish() {},
    play() {},
    pause() {},
    reverse() {},
  }
  queueMicrotask(() => animation.onfinish?.())
  return animation as unknown as Animation
}

afterEach(() => {
  cleanup()
})
