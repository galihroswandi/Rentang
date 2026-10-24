<script lang="ts">
  import Icon from '../icons/Icon.svelte'
  import { effectiveTheme, switchTheme } from './theme.ts'

  let theme = $state(effectiveTheme())
  const label = $derived(theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap')

  function toggle(event: MouseEvent & { currentTarget: HTMLButtonElement }): void {
    const box = event.currentTarget.getBoundingClientRect()
    theme = theme === 'dark' ? 'light' : 'dark'
    switchTheme(theme, { x: box.left + box.width / 2, y: box.top + box.height / 2 })
  }
</script>

<button
  type="button"
  aria-label={label}
  title={label}
  onclick={toggle}
  class="btn-icon overflow-hidden"
>
  {#key theme}
    <span class="icon flex">
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
    </span>
  {/key}
</button>

<style>
  .icon {
    animation: turn 420ms var(--ease-spring);
  }
  @keyframes turn {
    from {
      opacity: 0;
      transform: rotate(-90deg) scale(0.5);
    }
  }
</style>
