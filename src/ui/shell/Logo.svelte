<script lang="ts">
  let { size = 26 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" class="logo flex-none">
  <rect width="26" height="26" rx="7" class="fill-accent" />
  <rect x="5" y="6.5" width="10" height="3" rx="1.5" class="bar fill-on-accent" />
  <rect x="9" y="11.5" width="11.5" height="3" rx="1.5" class="bar fill-on-accent" />
  <rect x="6.5" y="16.5" width="7" height="3" rx="1.5" class="bar fill-on-accent" />
</svg>

<style>
  /* The three bars of the mark slide in like a tiny Gantt chart, once, on load. */
  .bar {
    transform-box: fill-box;
    transform-origin: left center;
    animation: grow-x 620ms var(--ease-out) backwards;
  }
  .bar:nth-child(3) {
    animation-delay: 90ms;
  }
  .bar:nth-child(4) {
    animation-delay: 180ms;
  }
</style>
