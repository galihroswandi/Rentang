<script lang="ts">
  let { size = 26 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" class="logo flex-none">
  <rect width="256" height="256" rx="58" class="fill-accent" />
  <g
    fill="none"
    class="stroke-on-accent"
    stroke-width="28"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M72 62V194" />
    <path d="M72 62H140A31 31 0 0 1 140 124H72" />
    <!-- The leg of the R is two Gantt bars, one starting where the other ends; they grow in once, on load. -->
    <path d="M108 158H140" class="bar bar-1" />
    <path d="M144 192H184" class="bar bar-2" />
  </g>
</svg>

<style>
  .bar {
    transform-box: fill-box;
    transform-origin: left center;
    animation: grow-x 620ms var(--ease-out) backwards;
  }
  .bar-1 {
    animation-delay: 90ms;
  }
  .bar-2 {
    animation-delay: 180ms;
  }
</style>
