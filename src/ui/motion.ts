/**
 * Svelte transitions that respect "reduce motion": with the setting on, every transition
 * finishes instantly, so content still appears and leaves, just without movement.
 */
import { cubicOut } from 'svelte/easing'
import {
  fade as svelteFade,
  fly as svelteFly,
  scale as svelteScale,
  slide as svelteSlide,
  type FadeParams,
  type FlyParams,
  type ScaleParams,
  type SlideParams,
  type TransitionConfig,
} from 'svelte/transition'

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function calm<P extends { duration?: number | ((len: number) => number); delay?: number }>(
  params: P,
): P {
  return prefersReducedMotion() ? { ...params, duration: 0, delay: 0 } : params
}

export function fade(node: Element, params: FadeParams = {}): TransitionConfig {
  return svelteFade(node, calm({ duration: 180, easing: cubicOut, ...params }))
}

export function fly(node: Element, params: FlyParams = {}): TransitionConfig {
  return svelteFly(node, calm({ duration: 260, easing: cubicOut, y: 8, ...params }))
}

export function scale(node: Element, params: ScaleParams = {}): TransitionConfig {
  return svelteScale(node, calm({ duration: 200, easing: cubicOut, start: 0.96, ...params }))
}

export function slide(node: Element, params: SlideParams = {}): TransitionConfig {
  return svelteSlide(node, calm({ duration: 220, easing: cubicOut, ...params }))
}
