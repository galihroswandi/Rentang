import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/svelte'
import { afterEach } from 'vitest'

// jsdom does not implement scrolling.
Element.prototype.scrollTo = function scrollTo() {}

afterEach(() => {
  cleanup()
})
