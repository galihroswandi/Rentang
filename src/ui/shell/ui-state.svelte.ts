/** UI-only state shared by distant components: which dialogs are open, the file picker. */
export type FileKind = 'gan' | 'rentang'

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
