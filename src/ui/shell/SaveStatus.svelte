<script lang="ts">
  import type { SaveState } from '../../app/store/app-store.ts'
  import Icon from '../icons/Icon.svelte'

  let { state }: { state: SaveState } = $props()
</script>

<span role="status" class="flex items-center gap-1.5 text-[12.5px] text-text-3">
  {#if state === 'saving'}
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" class="animate-spin">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
      />
    </svg>
    <span class="max-sm:sr-only">Menyimpan…</span>
  {:else if state === 'failed'}
    <span class="flex text-danger"><Icon name="cloud-alert" size={15} /></span>
    <span class="text-danger max-sm:sr-only">Gagal menyimpan</span>
  {:else}
    {#key state}
      <span class={['flex', state === 'saved' && 'drawn']}
        ><Icon name="cloud-check" size={15} /></span
      >
    {/key}
    <span class="max-sm:sr-only">Tersimpan di browser</span>
  {/if}
</span>

<style>
  /* The tick (Lucide draws it first) draws itself each time a save lands. */
  .drawn :global(path:first-child) {
    stroke-dasharray: 12;
    stroke-dashoffset: 12;
    animation: draw 420ms var(--ease-out) 80ms forwards;
  }
</style>
