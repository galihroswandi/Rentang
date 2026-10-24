<script lang="ts">
  import Icon from '../icons/Icon.svelte'
  import { fly } from '../motion.ts'
  import { useApp } from './context.ts'

  const { store, app } = useApp()
  const TOAST_MS = 6000

  $effect(() => {
    const toast = $app.toast
    if (!toast) return
    const timer = setTimeout(() => {
      if (store.getState().toast?.id === toast.id) store.getState().dismissToast()
    }, TOAST_MS)
    return () => {
      clearTimeout(timer)
    }
  })
</script>

<div
  aria-live="polite"
  class="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
>
  {#if $app.toast}
    {#key $app.toast.id}
      <div
        in:fly={{ y: 24, duration: 320 }}
        out:fly={{ y: 12, duration: 180 }}
        class="pointer-events-auto relative flex max-w-full items-center gap-3 overflow-hidden rounded-lg bg-text py-2 pr-2 pl-4 text-[13px] text-bg shadow-pop"
      >
        <span class="truncate">{$app.toast.message}</span>
        {#if $app.toast.action}
          <button
            type="button"
            onclick={() => {
              if ($app.toast?.action === 'undo') store.getState().undo()
              else store.getState().redo()
            }}
            class="press flex h-8 items-center gap-1.5 rounded-md px-2.5 font-semibold text-accent hover:bg-bg/10"
          >
            <Icon name={$app.toast.action === 'undo' ? 'undo' : 'redo'} size={15} />
            {$app.toast.action === 'undo' ? 'Urungkan' : 'Ulangi'}
          </button>
        {/if}
        <button
          type="button"
          aria-label="Tutup pesan"
          onclick={() => {
            store.getState().dismissToast()
          }}
          class="press flex size-8 items-center justify-center rounded-md text-bg/70 hover:bg-bg/10 hover:text-bg"
        >
          <Icon name="x" size={14} strokeWidth={2} />
        </button>
        <!-- Time left before the message goes away. -->
        <span
          aria-hidden="true"
          class="countdown absolute inset-x-0 bottom-0 h-0.5 origin-left bg-accent"
        ></span>
      </div>
    {/key}
  {/if}
</div>

<style>
  .countdown {
    animation: shrink 6000ms linear forwards;
  }
  @keyframes shrink {
    to {
      transform: scaleX(0);
    }
  }
</style>
