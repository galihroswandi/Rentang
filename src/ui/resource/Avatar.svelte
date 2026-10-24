<script lang="ts">
  let { initials, name, size = 24 }: { initials: string; name: string; size?: number } = $props()
</script>

<span
  title={name}
  class="inline-flex flex-none items-center justify-center rounded-full border border-line-strong bg-surface-2 font-semibold tracking-[0.02em] text-text-2"
  style:width={`${String(size)}px`}
  style:height={`${String(size)}px`}
  style:font-size={`${String(Math.round(size * 0.36))}px`}
>
  <span aria-hidden="true">{initials}</span><span class="sr-only">{name}</span>
</span>
