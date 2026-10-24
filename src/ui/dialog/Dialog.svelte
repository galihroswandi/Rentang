<script lang="ts">
  import { Dialog } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import { cubicOut } from 'svelte/easing'
  import type { TransitionConfig } from 'svelte/transition'
  import Icon from '../icons/Icon.svelte'
  import { fade, prefersReducedMotion } from '../motion.ts'

  type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: Snippet
    children: Snippet
    footer?: Snippet
    width?: number
    /** Focus this element when the dialog opens instead of the first focusable one. */
    initialFocus?: () => HTMLElement | null | undefined
  }
  let {
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    width = 560,
    initialFocus,
  }: Props = $props()

  /** Scales in at the centre on wide screens and slides up as a sheet on phones. */
  function enter(_node: Element): TransitionConfig {
    const sheet = matchMedia('(max-width: 639px)').matches
    return {
      duration: prefersReducedMotion() ? 0 : sheet ? 320 : 220,
      easing: cubicOut,
      css: (t) =>
        sheet
          ? `transform: translateY(${String((1 - t) * 100)}%)`
          : `opacity: ${String(t)}; transform: translate(-50%, -50%) scale(${String(0.96 + 0.04 * t)})`,
    }
  }
</script>

<Dialog.Root {open} {onOpenChange}>
  <Dialog.Portal>
    <Dialog.Overlay forceMount>
      {#snippet child({ props, open: visible })}
        {#if visible}
          <div
            {...props}
            transition:fade={{ duration: 200 }}
            class="fixed inset-0 z-40 bg-[rgb(10_9_8/45%)] backdrop-blur-[2px]"
          ></div>
        {/if}
      {/snippet}
    </Dialog.Overlay>
    <Dialog.Content
      forceMount
      onOpenAutoFocus={(event) => {
        const target = initialFocus?.()
        if (target) {
          event.preventDefault()
          target.focus()
        }
      }}
    >
      {#snippet child({ props, open: visible })}
        {#if visible}
          <div
            {...props}
            transition:enter
            style:--dialog-width={`${String(width)}px`}
            class="dialog fixed z-50 flex flex-col overflow-hidden border border-line-strong bg-surface text-text shadow-pop"
          >
            <div class="flex items-start gap-3 px-6 pt-5 pb-3 max-sm:px-5">
              <div class="min-w-0 flex-1">
                <Dialog.Title level={2} class="m-0 text-lg font-semibold tracking-[-0.01em]"
                  >{title}</Dialog.Title
                >
                {#if description}
                  <Dialog.Description class="mt-1 mb-0 text-[13px] text-text-2">
                    {@render description()}
                  </Dialog.Description>
                {/if}
              </div>
              <Dialog.Close class="btn-ghost -mt-1 -mr-2 size-9" aria-label="Tutup">
                <Icon name="x" size={16} strokeWidth={2} />
              </Dialog.Close>
            </div>
            <!-- Keyboard users must be able to reach and scroll a long dialog body. -->
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <div
              tabindex="0"
              role="region"
              aria-label={title}
              class="min-h-0 flex-1 overflow-y-auto px-6 pb-5 focus-visible:outline-offset-[-2px] max-sm:px-5"
            >
              {@render children()}
            </div>
            {#if footer}
              <div
                class="flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface-2 px-6 py-3.5 max-sm:px-5 max-sm:pb-[max(14px,env(safe-area-inset-bottom))]"
              >
                {@render footer()}
              </div>
            {/if}
          </div>
        {/if}
      {/snippet}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .dialog {
    top: 50%;
    left: 50%;
    width: min(var(--dialog-width), calc(100vw - 32px));
    max-height: min(760px, calc(100dvh - 32px));
    border-radius: 14px;
    transform: translate(-50%, -50%);
  }
  @media (max-width: 639px) {
    .dialog {
      top: auto;
      bottom: 0;
      left: 0;
      width: 100%;
      max-height: calc(100dvh - 24px);
      border-radius: 16px 16px 0 0;
      transform: none;
    }
  }
</style>
