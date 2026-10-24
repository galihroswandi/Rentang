<script lang="ts">
  import { prefersReducedMotion } from '../motion.ts'

  let { value, duration = 700 }: { value: number; duration?: number } = $props()
  let shown = $state(0)

  $effect(() => {
    const target = value
    if (prefersReducedMotion() || target === 0) {
      shown = target
      return
    }
    const started = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - started) / duration)
      shown = Math.round(target * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  })
</script>

<!-- Screen readers get the final number straight away. -->
<span aria-hidden="true">{shown}</span><span class="sr-only">{value}</span>
