/** UI-only state shared by distant components: which dialogs are open, the file picker. */
import type { FileKind } from '../file-access.ts'

export type { FileKind }

export class UiState {
  newProjectOpen = $state(false)
  #picker: ((kind: FileKind) => void) | null = null

  registerPicker(picker: (kind: FileKind) => void): void {
    this.#picker = picker
  }

  pick(kind: FileKind): void {
    this.#picker?.(kind)
  }
}
