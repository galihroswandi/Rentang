<script lang="ts">
  import { tick, untrack } from 'svelte'
  import {
    addDocument,
    deleteDocument,
    documentsInOrder,
    importDocuments,
    moveDocument,
    renameDocument,
    setDocumentContent,
  } from '../../app/edits/document-edits.ts'
  import type { CriticalPath } from '../../core/critical-path.ts'
  import type { IsoDate } from '../../core/dates.ts'
  import { documentFromMarkdown } from '../../core/markdown.ts'
  import type { Project } from '../../core/model.ts'
  import {
    countWords,
    headingsOf,
    mentionedTaskIds,
    plainTextOf,
    type Json,
  } from '../../core/rich-text.ts'
  import Icon from '../icons/Icon.svelte'
  import { fly, prefersReducedMotion } from '../motion.ts'
  import { useApp } from '../shell/context.ts'
  import { buildTaskRows } from '../table/rows.ts'
  import TypeChip from '../table/TypeChip.svelte'
  import DocumentEditor from './DocumentEditor.svelte'
  import {
    capitalized,
    documentTitle,
    timeAgo,
    titleFromFileName,
    wordsLabel,
  } from './document-text.ts'
  import type { DocumentEditor as EditorHandle } from './editor.ts'
  import { taskLinks } from './task-links.ts'

  type Props = {
    project: Project
    analysis: CriticalPath | null
    progress: ReadonlyMap<string, number>
    today: IsoDate
    /** The open document; null or unknown opens the first one. */
    selectedId: string | null
    onSelect: (id: string) => void
    /** Incremented by the toolbar's "Dokumen" button; each change adds a document. */
    addRequest: number
    /** Incremented by the toolbar's "Impor .md" button; each change opens the file picker. */
    importRequest: number
    /** Opens a task in the Gantt view. */
    onShowTask: (taskId: string) => void
  }
  let {
    project,
    analysis,
    progress,
    today,
    selectedId,
    onSelect,
    addRequest,
    importRequest,
    onShowTask,
  }: Props = $props()

  const { store } = useApp()

  const documents = $derived(documentsInOrder(project.documents))
  const current = $derived(
    documents.find((document) => document.id === selectedId) ?? documents[0] ?? null,
  )
  const links = $derived(
    taskLinks(buildTaskRows({ project, analysis, progress, collapsed: new Set(), today }), today),
  )

  // What the editor shows right now, ahead of the save that follows typing.
  let live = $state.raw<{ readonly id: string; readonly content: Json } | null>(null)
  const shown = $derived(live?.id === current?.id ? live?.content : current?.content)
  const headings = $derived(headingsOf(shown))
  const mentioned = $derived(mentionedTaskIds(shown))
  const words = $derived(countWords(plainTextOf(shown, (id) => links.get(id)?.name)))

  let focusedTask: string | null = $state(null)
  let activeHeading = $state(0)
  let editorHandle = $state.raw<EditorHandle | null>(null)
  let titleInput: HTMLTextAreaElement | undefined = $state()
  let titleVisit = 0
  let dragId: string | null = $state(null)
  let dropTarget: { id: string; place: 'before' | 'after' } | null = $state(null)

  // Relative times ("12 menit lalu") move on while the page stays open.
  let now = $state(new Date())
  $effect(() => {
    const timer = setInterval(() => (now = new Date()), 30_000)
    return () => {
      clearInterval(timer)
    }
  })

  const stamp = (): string => new Date().toISOString()

  let handledAdd = untrack(() => addRequest)
  $effect(() => {
    if (addRequest === handledAdd) return
    handledAdd = addRequest
    untrack(() => void create())
  })

  /** A Markdown file is text, and a note is never this long; a bigger file is something else. */
  const MAX_IMPORT_BYTES = 1024 * 1024

  let fileInput: HTMLInputElement | undefined = $state()
  let importProblems: string[] = $state([])

  let handledImport = untrack(() => importRequest)
  $effect(() => {
    if (importRequest === handledImport) return
    handledImport = importRequest
    untrack(() => fileInput?.click())
  })

  /** Reads one Markdown file; a string says why it could not be used. */
  async function readMarkdown(file: File): Promise<{ title: string; content: Json } | string> {
    if (file.size > MAX_IMPORT_BYTES)
      return `${file.name}: lebih dari 1 MB, terlalu besar untuk dokumen.`
    let source: string
    try {
      source = await file.text()
    } catch {
      return `${file.name}: tidak bisa dibaca.`
    }
    if (source.includes('\u0000')) return `${file.name}: bukan berkas teks.`
    const { title, content } = documentFromMarkdown(source)
    return { title: title ?? titleFromFileName(file.name), content }
  }

  /** Every file becomes a document of its own; all of them are one step in the history. */
  async function importFiles(files: FileList | null): Promise<void> {
    const picked = [...(files ?? [])]
    if (picked.length === 0) return
    const imported: { id: string; title: string; content: Json }[] = []
    const problems: string[] = []
    for (const file of picked) {
      const result = await readMarkdown(file)
      if (typeof result === 'string') problems.push(result)
      else imported.push({ id: store.getState().createId(), ...result })
    }
    importProblems = problems
    const first = imported[0]
    if (!first) return
    const message =
      imported.length === 1 ? 'Dokumen diimpor' : `${String(imported.length)} dokumen diimpor`
    if (store.getState().edit(message, importDocuments(imported, stamp())) === 'applied') {
      open(first.id)
    }
  }

  async function create(): Promise<void> {
    const id = store.getState().createId()
    if (store.getState().edit('Dokumen ditambahkan', addDocument(id, stamp())) !== 'applied') return
    open(id)
    await tick()
    titleInput?.focus()
  }

  function open(id: string): void {
    focusedTask = null
    activeHeading = 0
    onSelect(id)
  }

  function rename(id: string, title: string): void {
    store.getState().edit('Judul dokumen diubah', renameDocument(id, title, stamp()), {
      quiet: true,
      mergeKey: `title:${id}:${String(titleVisit)}`,
    })
  }

  function commit(id: string, content: Json, visit: number): void {
    store.getState().edit('Isi dokumen diubah', setDocumentContent(id, content, stamp()), {
      quiet: true,
      mergeKey: `content:${id}:${String(visit)}`,
    })
  }

  function remove(id: string): void {
    const index = documents.findIndex((document) => document.id === id)
    const neighbour = documents[index + 1] ?? documents[index - 1]
    store.getState().edit('Dokumen dihapus', deleteDocument(id))
    if (neighbour) open(neighbour.id)
  }

  function move(id: string, targetId: string, place: 'before' | 'after'): void {
    store.getState().edit('Urutan dokumen diubah', moveDocument(id, targetId, place))
  }

  /** Alt with an arrow moves the document in the list, as dragging does. */
  function moveByKey(event: KeyboardEvent, index: number): void {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    const document = documents[index]
    const neighbour = documents[index + (event.key === 'ArrowUp' ? -1 : 1)]
    if (!document || !neighbour) return
    event.preventDefault()
    move(document.id, neighbour.id, event.key === 'ArrowUp' ? 'before' : 'after')
    void tick().then(() => {
      window.document.querySelector<HTMLElement>(`[data-document-id="${document.id}"]`)?.focus()
    })
  }

  function dropPlace(event: DragEvent): 'before' | 'after' {
    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return 'after'
    const box = target.getBoundingClientRect()
    return event.clientY < box.top + box.height / 2 ? 'before' : 'after'
  }

  function endDrag(): void {
    dragId = null
    dropTarget = null
  }

  function showHeading(index: number): void {
    activeHeading = index
    editorHandle?.headingElement(index)?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  /** The heading nearest the top of the page is the one being read. */
  function followScroll(event: Event): void {
    const scroller = event.currentTarget
    if (!(scroller instanceof HTMLElement) || !editorHandle) return
    const top = scroller.getBoundingClientRect().top + 96
    let reading = 0
    for (let index = 0; index < headings.length; index++) {
      const element = editorHandle.headingElement(index)
      if (element && element.getBoundingClientRect().top <= top) reading = index
    }
    activeHeading = reading
  }

  function highlight(taskId: string): void {
    focusedTask = focusedTask === taskId ? null : taskId
    if (focusedTask === null) return
    void tick().then(() => {
      window.document.getElementById(`linked-${taskId}`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  function titleKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return
    event.preventDefault()
    editorHandle?.focus('start')
  }
</script>

{#snippet problemsNotice()}
  {#if importProblems.length > 0}
    <div
      role="alert"
      class="mb-4 flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-text"
    >
      <span class="mt-0.5 flex text-danger"><Icon name="alert" size={16} /></span>
      <div class="min-w-0 flex-1">
        <p class="m-0 font-semibold">Tidak semua berkas bisa diimpor</p>
        <ul class="m-0 mt-1 list-none p-0 text-text-2">
          {#each importProblems as problem (problem)}
            <li class="break-words">{problem}</li>
          {/each}
        </ul>
      </div>
      <button
        type="button"
        class="btn-ghost size-7 p-0"
        aria-label="Tutup pesan"
        onclick={() => (importProblems = [])}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  {/if}
{/snippet}

<input
  bind:this={fileInput}
  type="file"
  multiple
  accept=".md,.markdown,.mdown,text/markdown"
  class="hidden"
  aria-label="Pilih berkas Markdown"
  onchange={(event) => {
    const input = event.currentTarget
    void importFiles(input.files).finally(() => (input.value = ''))
  }}
/>

{#if current}
  <div class="flex min-h-0 flex-1">
    <nav
      aria-label="Dokumen proyek"
      class="flex w-64 flex-none flex-col gap-0.5 overflow-y-auto border-r border-line bg-surface-2 px-3 py-4 max-md:hidden"
    >
      <div class="flex items-center justify-between px-2 pt-0.5 pb-2.5">
        <h2 class="m-0 text-xs font-semibold text-text-2">Dokumen proyek</h2>
        <span class="mono text-[11.5px] text-text-3">{documents.length}</span>
      </div>
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        {#each documents as document, index (document.id)}
          {@const on = document.id === current.id}
          {@const changed = timeAgo(document.updatedAt, now)}
          <li
            class={[
              'relative rounded-lg',
              dragId === document.id && 'opacity-50',
              dropTarget?.id === document.id &&
                (dropTarget.place === 'before' ? 'drop-before' : 'drop-after'),
            ]}
            draggable="true"
            ondragstart={(event) => {
              dragId = document.id
              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', documentTitle(document.title))
              }
            }}
            ondragover={(event) => {
              if (dragId === null || dragId === document.id) return
              event.preventDefault()
              dropTarget = { id: document.id, place: dropPlace(event) }
            }}
            ondragleave={() => {
              if (dropTarget?.id === document.id) dropTarget = null
            }}
            ondrop={(event) => {
              event.preventDefault()
              if (dragId !== null && dragId !== document.id) {
                move(dragId, document.id, dropPlace(event))
              }
              endDrag()
            }}
            ondragend={endDrag}
          >
            <button
              type="button"
              data-document-id={document.id}
              aria-current={on ? 'page' : undefined}
              aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
              onclick={() => {
                open(document.id)
              }}
              onkeydown={(event) => {
                moveByKey(event, index)
              }}
              class={[
                'press group flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left',
                on ? 'border-line bg-surface shadow-sm' : 'border-transparent hover:bg-surface/70',
              ]}
            >
              <span class={['flex', on ? 'text-accent-text' : 'text-text-3']}
                ><Icon name="file-text" /></span
              >
              <span class="flex min-w-0 flex-1 flex-col">
                <span
                  class={[
                    'truncate text-[13.5px]',
                    on ? 'font-semibold' : 'font-medium',
                    document.title.trim() === '' && 'text-text-3',
                  ]}>{documentTitle(document.title)}</span
                >
                <span class="text-[11.5px] text-text-3"
                  >{changed === null ? 'Belum diubah' : capitalized(changed)}</span
                >
              </span>
              <span
                aria-hidden="true"
                class="flex cursor-grab text-text-3 opacity-0 transition-opacity group-hover:opacity-60 group-focus-visible:opacity-60"
                ><Icon name="grip" size={14} /></span
              >
            </button>
          </li>
        {/each}
      </ul>
      <p class="mx-2 mt-3.5 mb-0 text-xs leading-normal text-text-3">
        Halaman datar tanpa sub-halaman. Seret untuk mengubah urutan, atau Alt dan panah.
      </p>
    </nav>

    <main class="min-w-0 flex-1 overflow-y-auto bg-surface" onscroll={followScroll}>
      {#key current.id}
        {@const document = current}
        {@const changed = timeAgo(document.updatedAt, now)}
        <article
          in:fly={{ y: 6, duration: 240 }}
          class="mx-auto max-w-[760px] px-14 pt-9 pb-40 max-lg:px-10 max-md:px-5 max-md:pt-5"
        >
          {@render problemsNotice()}
          <label class="mb-4 flex flex-col gap-1.5 md:hidden">
            <span class="label">Dokumen</span>
            <select
              class="field"
              value={document.id}
              onchange={(event) => {
                open(event.currentTarget.value)
              }}
            >
              {#each documents as option (option.id)}
                <option value={option.id}>{documentTitle(option.title)}</option>
              {/each}
            </select>
          </label>

          <div class="flex flex-wrap items-center gap-2 text-[12.5px] text-text-3">
            <Icon name="clock" size={13} />
            {#if changed !== null}
              <span>Diubah {changed}</span>
              <span aria-hidden="true">·</span>
            {/if}
            <span>{wordsLabel(words)}</span>
            <button
              type="button"
              class="btn-ghost ml-auto h-7 px-2 text-[12.5px] hover:text-danger"
              title="Hapus dokumen ini (bisa diurungkan)"
              onclick={() => {
                remove(document.id)
              }}
            >
              <Icon name="trash" size={14} />
              Hapus
            </button>
          </div>

          <h2 class="sr-only">{documentTitle(document.title)}</h2>
          <textarea
            bind:this={titleInput}
            rows="1"
            value={document.title}
            placeholder="Tanpa judul"
            aria-label="Judul dokumen"
            spellcheck="false"
            class="title mt-3 mb-[18px] block w-full resize-none border-0 bg-transparent p-0 text-[34px] leading-[1.2] font-semibold tracking-[-0.02em] text-text outline-none placeholder:text-text-3"
            onfocus={() => (titleVisit += 1)}
            oninput={(event) => {
              rename(document.id, event.currentTarget.value)
            }}
            onkeydown={titleKey}></textarea>

          <DocumentEditor
            documentId={document.id}
            content={document.content}
            {links}
            {focusedTask}
            onInput={(content: Json) => {
              live = { id: document.id, content }
            }}
            onCommit={commit}
            onMention={highlight}
            onReady={(handle: EditorHandle | null) => (editorHandle = handle)}
          />
        </article>
      {/key}
    </main>

    <aside
      aria-label="Ringkasan dokumen"
      class="flex w-[272px] flex-none flex-col gap-6 overflow-y-auto border-l border-line bg-surface px-5 py-6 max-lg:hidden"
    >
      <section>
        <h2 class="mt-0 mb-2 text-xs font-semibold text-text-2">Di halaman ini</h2>
        {#if headings.length === 0}
          <p class="m-0 text-[12.5px] text-text-3">Belum ada judul. Ketik # di awal baris.</p>
        {:else}
          <ul class="m-0 list-none p-0">
            {#each headings as heading, index (index)}
              <li>
                <button
                  type="button"
                  aria-current={index === activeHeading ? 'location' : undefined}
                  class={[
                    'flex w-full items-center gap-2.5 py-[5px] text-left text-[13px] hover:text-text',
                    heading.level === 2 && 'pl-4',
                    index === activeHeading ? 'font-semibold text-text' : 'text-text-2',
                  ]}
                  onclick={() => {
                    showHeading(index)
                  }}
                >
                  <span
                    aria-hidden="true"
                    class={[
                      'size-1.5 flex-none rounded-full',
                      index === activeHeading ? 'bg-accent' : 'bg-line-strong',
                    ]}
                  ></span>
                  <span class="truncate">{heading.text || 'Judul kosong'}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section>
        <div class="mb-2.5 flex items-baseline justify-between">
          <h2 class="m-0 text-xs font-semibold text-text-2">Tugas yang disebut</h2>
          <span class="mono text-[11.5px] text-text-3">{mentioned.length}</span>
        </div>
        {#if mentioned.length === 0}
          <p class="m-0 text-[12.5px] text-text-3">Belum ada tugas yang disebut.</p>
        {:else}
          <ul class="m-0 flex list-none flex-col gap-2 p-0">
            {#each mentioned as taskId (taskId)}
              {@const link = links.get(taskId)}
              <li id={`linked-${taskId}`}>
                {#if link}
                  <button
                    type="button"
                    title="Buka di Gantt"
                    class={[
                      'press flex w-full flex-col gap-[7px] rounded-[10px] border px-3 py-2.5 text-left',
                      focusedTask === taskId
                        ? 'border-accent-border bg-accent-soft'
                        : 'border-line bg-surface hover:border-text-3',
                    ]}
                    onclick={() => {
                      onShowTask(taskId)
                    }}
                  >
                    <span class="flex min-w-0 items-center gap-2">
                      {#if link.type}<TypeChip type={link.type} />{/if}
                      <span class="truncate text-[13px] font-semibold">{link.name}</span>
                    </span>
                    {#if !link.isMilestone}
                      <span class="flex items-center gap-2">
                        <span class="h-1 flex-1 overflow-hidden rounded-sm bg-track">
                          <span
                            class={[
                              'block h-full',
                              link.progress >= 100 ? 'bg-text-3' : 'bg-accent',
                            ]}
                            style:width={`${String(link.progress)}%`}
                          ></span>
                        </span>
                        <span class="mono text-[11.5px] text-text-2">{link.progress}%</span>
                      </span>
                    {/if}
                    <span class="flex flex-wrap items-center gap-1.5">
                      <span class="mono text-[11.5px] text-text-3">{link.range}</span>
                      {#if link.lateDays > 0}
                        <span
                          class="inline-flex h-5 items-center rounded-full bg-danger/10 px-2 text-[11.5px] font-semibold text-danger"
                          >Terlambat {link.lateDays} hari</span
                        >
                      {/if}
                    </span>
                  </button>
                {:else}
                  <p
                    class="m-0 rounded-[10px] border border-dashed border-line-strong px-3 py-2.5 text-[12.5px] text-text-3"
                  >
                    Tugas ini sudah dihapus dari Gantt.
                  </p>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <p class="m-0 border-t border-line pt-4 text-xs leading-[1.55] text-text-3">
        Ketik @ di mana saja untuk menyebut tugas. Tanggal dan kemajuannya ikut terbarui saat jadwal
        berubah.
      </p>
    </aside>
  </div>
{:else}
  <main class="flex min-h-0 flex-1 overflow-y-auto bg-surface">
    <div
      in:fly={{ y: 6, duration: 240 }}
      class="m-auto flex max-w-[400px] flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <span
        class="pop flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-text"
        ><Icon name="file-text" size={22} /></span
      >
      {@render problemsNotice()}
      <h2 class="m-0 text-[15px] font-semibold">Belum ada dokumen</h2>
      <p class="m-0 text-[13px] text-text-2">
        Tulis rencana, catatan rapat, atau keputusan proyek di sini. Ketik @ untuk menyebut tugas
        dari Gantt, dan tanggalnya ikut terbarui saat jadwal berubah.
      </p>
      <div class="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button type="button" class="btn-primary" onclick={() => void create()}>
          <Icon name="file-plus" />
          Dokumen baru
        </button>
        <button type="button" class="btn" onclick={() => fileInput?.click()}>
          <Icon name="upload" />
          Impor .md
        </button>
      </div>
    </div>
  </main>
{/if}

<style>
  .title {
    field-sizing: content;
    min-height: 1.2em;
  }

  /* Where a dragged document will land. */
  .drop-before::before,
  .drop-after::after {
    content: '';
    position: absolute;
    left: 8px;
    right: 8px;
    height: 2px;
    border-radius: 1px;
    background: var(--color-accent);
  }
  .drop-before::before {
    top: -2px;
  }
  .drop-after::after {
    bottom: -2px;
  }

  main :global(.doc-body h3),
  main :global(.doc-body h4) {
    scroll-margin-top: 24px;
  }
</style>
