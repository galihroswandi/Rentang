/**
 * Open and save files through the File System Access API (Chrome, Edge). Its file filters are
 * glob patterns, so `.rentang` stays selectable where the system does not know the extension.
 * Without the API, callers fall back to a file input and a plain download.
 */

type PickerType = { description: string; accept: Record<string, string[]> }

// lib.dom has the handle types but not the window pickers yet.
type FilePickerWindow = {
  showOpenFilePicker?: (options: {
    types: PickerType[]
    excludeAcceptAllOption?: boolean
  }) => Promise<{ getFile(): Promise<File> }[]>
  showSaveFilePicker?: (options: { suggestedName: string; types: PickerType[] }) => Promise<{
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>
  }>
}

export type FileKind = 'gan' | 'rentang'

const TYPES: Record<FileKind, PickerType> = {
  gan: { description: 'Proyek .gan', accept: { 'application/xml': ['.gan'] } },
  rentang: { description: 'Proyek Rentang', accept: { 'application/json': ['.rentang'] } },
}

export const canPickFiles = (): boolean =>
  typeof window !== 'undefined' && 'showOpenFilePicker' in window

export const canSaveFiles = (): boolean =>
  typeof window !== 'undefined' && 'showSaveFilePicker' in window

function cancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** The chosen file, or null if the person closed the dialog. Throws if the API is missing. */
export async function pickFile(kind: FileKind): Promise<File | null> {
  const picker = (window as FilePickerWindow).showOpenFilePicker
  if (!picker) throw new Error('File System Access API is not available')
  try {
    const [handle] = await picker.call(window, {
      types: [TYPES[kind]],
      excludeAcceptAllOption: true,
    })
    return (await handle?.getFile()) ?? null
  } catch (error) {
    if (cancelled(error)) return null
    throw error
  }
}

/** Writes `text` where the person chooses, or downloads it; false if they cancelled. */
export async function saveFile(
  kind: FileKind,
  suggestedName: string,
  text: string,
): Promise<boolean> {
  const picker = (window as FilePickerWindow).showSaveFilePicker
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName, types: [TYPES[kind]] })
      const writable = await handle.createWritable()
      await writable.write(text)
      await writable.close()
      return true
    } catch (error) {
      if (cancelled(error)) return false
      // Any other failure (blocked, unwritable) falls back to a plain download below.
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = suggestedName
  link.click()
  URL.revokeObjectURL(url)
  return true
}
