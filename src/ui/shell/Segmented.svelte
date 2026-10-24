<script lang="ts" generics="T extends string">
  import Icon, { type IconName } from '../icons/Icon.svelte'

  type Option = { value: T; label: string; icon?: IconName }
  type Props = {
    options: readonly Option[]
    value: T
    label: string
    onChange: (value: T) => void
    /** Hide labels below this container width, keeping icons; null keeps them always. */
    compact?: boolean
  }
  let { options, value, label, onChange, compact = false }: Props = $props()

  const buttons: HTMLButtonElement[] = $state([])
  const activeIndex = $derived(options.findIndex((option) => option.value === value))
  // The pill slides under the active option; measured from the rendered buttons.
  let pill = $state({ left: 0, width: 0, ready: false })

  $effect(() => {
    const button = buttons[activeIndex]
    if (!button) return
    const update = () => {
      pill = { left: button.offsetLeft, width: button.offsetWidth, ready: true }
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(button)
    return () => {
      observer.disconnect()
    }
  })
</script>

<div
  role="group"
  aria-label={label}
  class="relative flex gap-0.5 rounded-[9px] border border-line bg-surface-2 p-[3px]"
>
  <span
    aria-hidden="true"
    class={[
      'absolute top-[3px] bottom-[3px] rounded-[6px] bg-seg-on shadow-seg',
      pill.ready && 'transition-[left,width] duration-300 ease-(--ease-spring)',
    ]}
    style:left={`${String(pill.left)}px`}
    style:width={`${String(pill.width)}px`}
  ></span>
  {#each options as option, index (option.value)}
    <button
      bind:this={buttons[index]}
      type="button"
      aria-pressed={option.value === value}
      onclick={() => {
        onChange(option.value)
      }}
      class={[
        'press relative inline-flex h-[30px] items-center gap-1.5 rounded-[6px] px-3 text-[13px]',
        option.value === value
          ? 'font-semibold text-text'
          : 'font-medium text-text-2 hover:text-text',
      ]}
    >
      {#if option.icon}<Icon name={option.icon} size={15} />{/if}
      <span class={compact ? 'max-sm:sr-only' : ''}>{option.label}</span>
    </button>
  {/each}
</div>
