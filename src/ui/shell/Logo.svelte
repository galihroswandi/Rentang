<script lang="ts">
  let { size = 24 }: { size?: number } = $props()
</script>

<svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
  <rect width="22" height="22" rx="5" class="fill-amber" />
  <rect x="4" y="5" width="9" height="3" rx="1.5" class="fill-on-amber" />
  <rect x="8" y="10" width="10" height="3" rx="1.5" class="fill-on-amber" />
  <rect x="5" y="15" width="8" height="3" rx="1.5" class="fill-on-amber" />
</svg>
