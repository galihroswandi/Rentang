import { CURRENT_SCHEMA_VERSION, type Project } from '../../core/model.ts'

/** The `.rentang` text for a project: JSON with a `schemaVersion`. */
export function serializeProject(project: Project): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, project }, null, 2)
}

/** A safe download name from the project name, e.g. "Kedai Kopi" -> "Kedai-Kopi.rentang". */
export function projectFileName(name: string): string {
  const stem = name
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${stem === '' ? 'proyek' : stem}.rentang`
}
