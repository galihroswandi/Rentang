<script lang="ts">
  import { onMount } from 'svelte'
  import type { Json } from '../../core/rich-text.ts'
  import Icon from '../icons/Icon.svelte'
  import TypeChip from '../table/TypeChip.svelte'
  import type { IconName } from '../icons/Icon.svelte'
  import type { DocumentEditor, EditorMenu, TableAction } from './editor.ts'
  import type { TaskLink } from './task-links.ts'

  type Props = {
    /** Fixed for the editor's life: a different document gets a new editor. */
    documentId: string
    /** The stored content. A change that did not come from typing here is shown as it is. */
    content: Json
    links: ReadonlyMap<string, TaskLink>
    /** The task whose chips are highlighted. */
    focusedTask: string | null
    /** Every change while typing, for the outline and cards beside the page. */
    onInput: (content: Json) => void
    /**
     * Changes to save: a moment after typing stops, and when the editor is left. `visit`
     * counts the times the editor was entered, so one visit can become one undo step.
     */
    onCommit: (documentId: string, content: Json, visit: number) => void
    onMention: (taskId: string) => void
    /** The editor once it has loaded, and null again when it is gone. */
    onReady?: (editor: DocumentEditor | null) => void
  }
  let { documentId, content, links, focusedTask, onInput, onCommit, onMention, onReady }: Props =
    $props()

  // Saved under the document it was opened for, even while the next one is already showing.
  // svelte-ignore state_referenced_locally
  const ownId = documentId

  const COMMIT_DELAY = 500
  const MENU_ID = 'document-menu'

  let host: HTMLDivElement | undefined = $state()
  let mountPoint: HTMLDivElement | undefined = $state()
  let editor = $state.raw<DocumentEditor | null>(null)
  let failed = $state(false)
  let menu = $state.raw<EditorMenu | null>(null)
  let active = $state(0)
  let menuElement: HTMLDivElement | undefined = $state()
  let menuPosition = $state({ left: 0, top: 0 })
  let spot: { pos: number; top: number } | null = $state(null)
  // Where the bar of the table holding the caret goes, in the host's own coordinates.
  let tableBar: { top: number; left: number } | null = $state(null)

  const TABLE_ACTIONS: readonly { action: TableAction; label: string; icon: IconName }[] = [
    { action: 'row-after', label: 'Tambah baris di bawah', icon: 'arrow-down-to-line' },
    { action: 'row-before', label: 'Tambah baris di atas', icon: 'arrow-up-to-line' },
    { action: 'column-after', label: 'Tambah kolom di kanan', icon: 'arrow-right-to-line' },
    { action: 'column-before', label: 'Tambah kolom di kiri', icon: 'arrow-left-to-line' },
  ]

  function showTableBar(table: HTMLElement | null): void {
    if (!table || !host) {
      tableBar = null
      return
    }
    const box = host.getBoundingClientRect()
    const rect = table.getBoundingClientRect()
    tableBar = { top: rect.top - box.top - 38, left: rect.left - box.left }
  }

  // The content this editor agrees with: what it was opened with, or last saved.
  let known = ''
  let pending: Json | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let visit = 0

  function flush(): void {
    clearTimeout(timer)
    if (pending === null) return
    const next = pending
    pending = null
    known = JSON.stringify(next)
    onCommit(ownId, next, visit)
  }

  function changed(next: Json): void {
    onInput(next)
    pending = next
    clearTimeout(timer)
    timer = setTimeout(flush, COMMIT_DELAY)
  }

  const menuItems = $derived<readonly unknown[]>(menu?.items ?? [])

  function chooseActive(): boolean {
    if (!menu) return false
    if (menu.kind === 'blocks') {
      const choice = menu.items[active]
      if (!choice) return false
      menu.choose(choice)
    } else {
      const link = menu.items[active]
      if (!link) return false
      menu.choose(link)
    }
    return true
  }

  function menuKey(event: KeyboardEvent): boolean {
    const count = menuItems.length
    if (event.key === 'ArrowDown' && count > 0) {
      active = (active + 1) % count
      return true
    }
    if (event.key === 'ArrowUp' && count > 0) {
      active = (active - 1 + count) % count
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') return chooseActive()
    return false
  }

  /** Below the caret, or above it when there is no room below; never off screen. */
  function placeMenu(): void {
    const rect = menu?.rect()
    if (!rect) return
    const width = menuElement?.offsetWidth ?? 312
    const height = menuElement?.offsetHeight ?? 320
    const below = rect.bottom + 6
    const top =
      below + height > innerHeight - 8 && rect.top - height - 6 > 8 ? rect.top - height - 6 : below
    menuPosition = { left: Math.max(8, Math.min(rect.left, innerWidth - width - 8)), top }
  }

  onMount(() => {
    let gone = false
    // TipTap is downloaded the first time a document opens, not with the app.
    void import('./editor.ts')
      .then(({ createDocumentEditor }) => {
        if (gone || !mountPoint) return
        known = JSON.stringify(content)
        const created = createDocumentEditor({
          element: mountPoint,
          content,
          label: 'Isi dokumen',
          links,
          focusedTask,
          onChange: changed,
          onMenu: (next) => {
            // New letters mean new matches, so the first one is picked again.
            active = 0
            menu = next
          },
          onMenuKey: menuKey,
          onMention: (id) => {
            onMention(id)
          },
          onTable: showTableBar,
          onFocus: () => {
            visit += 1
          },
          onBlur: flush,
        })
        editor = created
        onReady?.(created)
      })
      .catch(() => {
        failed = true
      })
    const hide = (): void => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', hide)
    addEventListener('pagehide', flush)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', hide)
      removeEventListener('pagehide', flush)
      flush()
      editor?.destroy()
      onReady?.(null)
    }
  })

  // Undo, redo or another change from outside: show it, and drop typing not saved yet.
  $effect(() => {
    const incoming = JSON.stringify(content)
    if (!editor || incoming === known) return
    clearTimeout(timer)
    pending = null
    known = incoming
    editor.setContent(content)
    onInput(content)
  })

  // Chips follow renamed tasks, new progress and dates, and the highlighted task.
  $effect(() => {
    editor?.showTasks(links, focusedTask)
  })

  // Each change of the menu is a new object, so this runs again as the query changes.
  $effect(() => {
    if (!menu) return
    placeMenu()
    const follow = (): void => {
      placeMenu()
    }
    addEventListener('scroll', follow, true)
    addEventListener('resize', follow)
    return () => {
      removeEventListener('scroll', follow, true)
      removeEventListener('resize', follow)
    }
  })

  // Moving through a long menu with the arrow keys keeps the chosen item in view.
  $effect(() => {
    menuElement
      ?.querySelector(`#${MENU_ID}-${String(active)}`)
      ?.scrollIntoView({ block: 'nearest' })
  })

  // The writing area owns the open menu, for screen readers.
  $effect(() => {
    const body = mountPoint?.querySelector('.doc-body')
    if (!body) return
    if (menu) {
      body.setAttribute('aria-controls', MENU_ID)
      body.setAttribute('aria-expanded', 'true')
      if (menuItems.length > 0)
        body.setAttribute('aria-activedescendant', `${MENU_ID}-${String(active)}`)
      else body.removeAttribute('aria-activedescendant')
    } else {
      body.removeAttribute('aria-controls')
      body.removeAttribute('aria-activedescendant')
      body.setAttribute('aria-expanded', 'false')
    }
  })

  function track(event: MouseEvent): void {
    // While a button is down the handle stays put, or a drag starting on it would be lost.
    if (event.buttons !== 0) return
    if (!editor?.readable || !host || !mountPoint || menu) return
    const column = mountPoint.getBoundingClientRect()
    // Measured inside the text column, so the pointer may sit in the gutter on the left.
    const found = editor.blockAt(column.left + 24, event.clientY)
    if (!found) {
      spot = null
      return
    }
    const line = parseFloat(getComputedStyle(found.element).lineHeight) || 26
    const top = found.element.getBoundingClientRect().top - host.getBoundingClientRect().top
    spot = { pos: found.pos, top: top + Math.max(0, (Math.min(line, 40) - 24) / 2) }
  }

  function groupStart(index: number): string | null {
    if (menu?.kind !== 'blocks') return null
    const group = menu.items[index]?.group
    return group !== undefined && menu.items[index - 1]?.group !== group ? group : null
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={host}
  class="editor-host relative"
  onmousemove={track}
  onmouseleave={() => (spot = null)}
>
  {#if failed}
    <p role="alert" class="m-0 text-[13px] text-danger">
      Editor tidak bisa dimuat. Periksa koneksi lalu buka dokumen ini lagi.
    </p>
  {:else if editor && !editor.readable}
    <p
      role="status"
      class="mt-0 mb-4 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] text-text-2"
    >
      Isi dokumen ini tidak bisa dibaca oleh versi Rentang ini, jadi hanya ditampilkan. Isinya tetap
      tersimpan apa adanya.
    </p>
  {:else if !editor}
    <div aria-hidden="true" class="flex flex-col gap-3 pt-1">
      <span class="h-4 w-11/12 rounded bg-surface-2"></span>
      <span class="h-4 w-4/5 rounded bg-surface-2"></span>
      <span class="h-4 w-2/3 rounded bg-surface-2"></span>
    </div>
  {/if}

  {#if spot}
    <div
      class="gutter absolute -left-12 flex w-[42px] justify-end gap-0.5"
      style:top={`${String(spot.top)}px`}
    >
      <button
        type="button"
        class="btn-ghost h-6 w-5 text-text-3"
        aria-label="Tambah blok di bawahnya"
        title="Tambah blok"
        onmousedown={(event) => {
          event.preventDefault()
        }}
        onclick={() => {
          if (spot) editor?.addBlockAfter(spot.pos)
        }}
      >
        <Icon name="plus" size={15} />
      </button>
      <!-- A drag handle only; the keyboard moves a block with Alt+Shift and the arrows. -->
      <div
        aria-hidden="true"
        class="btn-ghost h-6 w-5 cursor-grab text-text-3"
        title="Seret untuk memindah (atau Alt+Shift+panah)"
        draggable="true"
        ondragstart={(event) => {
          if (spot) editor?.dragBlock(spot.pos, event)
        }}
        ondragend={() => editor?.endDrag()}
      >
        <Icon name="grip" size={15} />
      </div>
    </div>
  {/if}

  {#if tableBar}
    <div
      role="toolbar"
      aria-label="Tabel"
      class="table-bar absolute z-10 flex h-8 items-center gap-0.5 rounded-lg border border-line-strong bg-surface px-1 shadow-pop"
      style:top={`${String(tableBar.top)}px`}
      style:left={`${String(tableBar.left)}px`}
    >
      {#each TABLE_ACTIONS as item (item.action)}
        <button
          type="button"
          class="btn-ghost size-6 text-text-2"
          aria-label={item.label}
          title={item.label}
          onmousedown={(event) => {
            event.preventDefault()
          }}
          onclick={() => editor?.tableAction(item.action)}
        >
          <Icon name={item.icon} size={15} />
        </button>
      {/each}
      <span class="mx-1 h-4 w-px bg-line" role="presentation"></span>
      <button
        type="button"
        class="btn-ghost h-6 px-1.5 text-xs text-text-2"
        onmousedown={(event) => {
          event.preventDefault()
        }}
        onclick={() => editor?.tableAction('toggle-header')}>Baris judul</button
      >
      <button
        type="button"
        class="btn-ghost h-6 px-1.5 text-xs text-text-2"
        onmousedown={(event) => {
          event.preventDefault()
        }}
        onclick={() => editor?.tableAction('delete-row')}>Hapus baris</button
      >
      <button
        type="button"
        class="btn-ghost h-6 px-1.5 text-xs text-text-2"
        onmousedown={(event) => {
          event.preventDefault()
        }}
        onclick={() => editor?.tableAction('delete-column')}>Hapus kolom</button
      >
      <button
        type="button"
        class="btn-ghost size-6 text-danger"
        aria-label="Hapus tabel"
        title="Hapus tabel"
        onmousedown={(event) => {
          event.preventDefault()
        }}
        onclick={() => editor?.tableAction('delete-table')}
      >
        <Icon name="trash" size={15} />
      </button>
    </div>
  {/if}

  <div bind:this={mountPoint}></div>
</div>

{#if menu}
  <div
    bind:this={menuElement}
    id={MENU_ID}
    role="listbox"
    aria-label={menu.kind === 'blocks' ? 'Pilih jenis blok' : 'Pilih tugas'}
    class="menu fixed z-40 w-[312px] overflow-y-auto rounded-[10px] border border-line-strong bg-surface p-1.5 shadow-pop"
    style:left={`${String(menuPosition.left)}px`}
    style:top={`${String(menuPosition.top)}px`}
  >
    {#if menu.kind === 'blocks'}
      {#each menu.items as choice, index (choice.kind)}
        {@const group = groupStart(index)}
        {#if group}
          {#if index > 0}<div class="mx-1 my-1.5 h-px bg-line" role="presentation"></div>{/if}
          <div class="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-text-2" role="presentation">
            {group}
          </div>
        {/if}
        <div
          id={`${MENU_ID}-${String(index)}`}
          role="option"
          tabindex="-1"
          aria-selected={index === active}
          class={[
            'flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left',
            index === active && 'bg-surface-2',
          ]}
          onmousemove={() => (active = index)}
          onmousedown={(event) => {
            event.preventDefault()
            if (menu?.kind === 'blocks') menu.choose(choice)
          }}
        >
          <span
            class="flex size-7 flex-none items-center justify-center rounded-md border border-line bg-surface text-text-2"
            ><Icon name={choice.icon} size={15} /></span
          >
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-[13.5px] leading-tight font-medium">{choice.label}</span>
            <span class="truncate text-[11.5px] leading-tight text-text-3"
              >{choice.description}</span
            >
          </span>
          {#if choice.hint}<span class="mono text-[11.5px] text-text-3">{choice.hint}</span>{/if}
        </div>
      {:else}
        <p class="m-0 px-2.5 py-2 text-[13px] text-text-3">Tidak ada jenis blok yang cocok.</p>
      {/each}
    {:else}
      <div class="px-2.5 pt-1 pb-1.5 text-xs font-semibold text-text-2" role="presentation">
        Sebut tugas
      </div>
      {#each menu.items as link, index (link.id)}
        <div
          id={`${MENU_ID}-${String(index)}`}
          role="option"
          tabindex="-1"
          aria-selected={index === active}
          class={[
            'flex h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left',
            index === active && 'bg-surface-2',
          ]}
          onmousemove={() => (active = index)}
          onmousedown={(event) => {
            event.preventDefault()
            if (menu?.kind === 'tasks') menu.choose(link)
          }}
        >
          {#if link.type}<TypeChip type={link.type} />{:else}<span class="w-[34px]"></span>{/if}
          <span class="min-w-0 flex-1 truncate text-[13.5px] font-medium">{link.name}</span>
          <span class="mono text-[11.5px] text-text-3">{link.meta}</span>
        </div>
      {:else}
        <p class="m-0 px-2.5 py-2 text-[13px] text-text-3">Tidak ada tugas yang cocok.</p>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .menu {
    max-height: min(472px, calc(100dvh - 32px));
    animation: menu-in 160ms var(--ease-out);
  }
  @keyframes menu-in {
    from {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }

  .gutter {
    animation: fade-in 120ms var(--ease-out);
  }

  /* The writing area. Its nodes are drawn by the editor, so they are styled as global here. */
  .editor-host :global(.doc-body) {
    min-height: 240px;
    outline: none;
    font-size: 15px;
    line-height: 1.75;
    color: var(--color-text);
    overflow-wrap: anywhere;
  }
  .editor-host :global(.doc-body > * + *) {
    margin-top: 6px;
  }
  .editor-host :global(.doc-body p) {
    margin: 0;
  }
  .editor-host :global(.doc-body h3) {
    margin: 22px 0 2px;
    font-size: 19px;
    line-height: 1.35;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .editor-host :global(.doc-body h4) {
    margin: 16px 0 0;
    font-size: 16px;
    line-height: 1.4;
    font-weight: 600;
  }
  .editor-host :global(.doc-body > :first-child) {
    margin-top: 0;
  }
  .editor-host :global(.doc-body ul),
  .editor-host :global(.doc-body ol) {
    margin: 0;
    padding-left: 24px;
  }
  .editor-host :global(.doc-body li + li) {
    margin-top: 2px;
  }
  .editor-host :global(.doc-body ul[data-type='taskList']) {
    padding-left: 2px;
    list-style: none;
  }
  .editor-host :global(.doc-body ul[data-type='taskList'] li) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .editor-host :global(.doc-body ul[data-type='taskList'] li > label) {
    display: flex;
    flex: none;
    margin-top: 6px;
  }
  .editor-host :global(.doc-body ul[data-type='taskList'] input[type='checkbox']) {
    width: 16px;
    height: 16px;
    margin: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
  }
  .editor-host :global(.doc-body ul[data-type='taskList'] li > div) {
    flex: 1;
    min-width: 0;
  }
  .editor-host :global(.doc-body ul[data-type='taskList'] li[data-checked='true'] > div) {
    color: var(--color-text-3);
  }
  .editor-host :global(.doc-body blockquote) {
    margin: 4px 0;
    padding-left: 14px;
    border-left: 3px solid var(--color-line-strong);
    color: var(--color-text-2);
  }
  .editor-host :global(.doc-body .callout) {
    display: flex;
    gap: 12px;
    margin: 10px 0 4px;
    padding: 14px 16px;
    border-radius: 10px;
    background: var(--color-accent-soft);
  }
  .editor-host :global(.doc-body .callout-icon) {
    display: flex;
    padding-top: 4px;
    color: var(--color-accent-text);
    user-select: none;
  }
  .editor-host :global(.doc-body .callout-text) {
    flex: 1;
    min-width: 0;
  }
  .editor-host :global(.doc-body .tableWrapper) {
    margin: 8px 0;
    overflow-x: auto;
  }
  .editor-host :global(.doc-body table) {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 14px;
  }
  .editor-host :global(.doc-body th),
  .editor-host :global(.doc-body td) {
    position: relative;
    min-width: 80px;
    padding: 6px 10px;
    border: 1px solid var(--color-line-strong);
    vertical-align: top;
    text-align: left;
  }
  .editor-host :global(.doc-body th) {
    background: var(--color-surface-2);
    font-weight: 600;
  }
  .editor-host :global(.doc-body .selectedCell::after) {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--color-accent-soft);
    pointer-events: none;
  }
  .editor-host :global(.doc-body code) {
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    background: var(--color-surface-2);
    font-family: var(--font-mono);
    font-size: 13px;
  }
  .editor-host :global(.doc-body pre) {
    margin: 8px 0;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    background: var(--color-surface-2);
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.6;
    overflow-x: auto;
  }
  .editor-host :global(.doc-body pre code) {
    padding: 0;
    background: none;
  }
  .editor-host :global(.doc-body hr) {
    margin: 18px 0;
    border: 0;
    border-top: 1px solid var(--color-line);
  }
  .editor-host :global(.doc-body a) {
    color: var(--color-accent-text);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .editor-host :global(.doc-body .is-empty::before) {
    content: attr(data-placeholder);
    float: left;
    height: 0;
    color: var(--color-text-3);
    pointer-events: none;
  }

  /* A task mention: its type, its name and its progress or date, read from the schedule. */
  .editor-host :global(.mention) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    margin: 0 1px;
    padding: 0 6px 0 3px;
    border: 1px solid var(--color-line);
    border-radius: 6px;
    background: var(--color-surface-2);
    vertical-align: -4px;
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
      border-color 160ms var(--ease-out),
      background-color 160ms var(--ease-out);
  }
  .editor-host :global(.mention:hover) {
    border-color: var(--color-text-3);
  }
  .editor-host :global(.mention.is-focused) {
    border-color: var(--color-accent-border);
    background: var(--color-accent-soft);
  }
  .editor-host :global(.mention-type) {
    display: inline-flex;
    align-items: center;
    height: 16px;
    padding: 0 4px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .editor-host :global(.mention-type[hidden]) {
    display: none;
  }
  .editor-host :global(.mention-type[data-type='IMP']) {
    background: var(--chip-imp-bg);
    color: var(--chip-imp-text);
  }
  .editor-host :global(.mention-type[data-type='DOC']) {
    background: var(--chip-doc-bg);
    color: var(--chip-doc-text);
  }
  .editor-host :global(.mention-type[data-type='DSG']) {
    background: var(--chip-dsg-bg);
    color: var(--chip-dsg-text);
  }
  .editor-host :global(.mention-type[data-type='BUG']) {
    background: var(--chip-bug-bg);
    color: var(--chip-bug-text);
  }
  .editor-host :global(.mention-type[data-type='FIX']) {
    background: var(--chip-fix-bg);
    color: var(--chip-fix-text);
  }
  .editor-host :global(.mention-type[data-type='REV']) {
    background: var(--chip-rev-bg);
    color: var(--chip-rev-text);
  }
  .editor-host :global(.mention-type[data-type='MS']) {
    background: var(--chip-ms-bg);
    color: var(--chip-ms-text);
  }
  .editor-host :global(.mention-meta) {
    font-size: 11px;
    font-weight: 400;
    color: var(--color-text-3);
  }
  .editor-host :global(.mention.is-missing .mention-name) {
    color: var(--color-text-3);
    text-decoration: line-through;
  }
</style>
