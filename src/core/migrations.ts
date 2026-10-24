/**
 * Upgrades saved .rentang files to the current schema version.
 *
 * Each migration takes a file at version N and returns it at version N + 1, so a file of
 * any older version is brought up to date by applying them in order. Migrations work on
 * plain JSON and must not throw for well-formed input of their version. The result is
 * validated against the current schema only after the last migration.
 */
import { CURRENT_SCHEMA_VERSION, projectFileSchema, type ProjectFile } from './model.ts'
import { err, ok, type Result } from './result.ts'

export type JsonObject = { [key: string]: unknown }

/** Migrates a file from the version it is keyed by to the next version. */
export type Migration = (file: JsonObject) => JsonObject

export type MigrationRegistry = Readonly<Record<number, Migration>>

/** Version 1 is the first released format, so there is nothing to migrate yet. */
export const migrations: MigrationRegistry = {}

export type LoadError =
  | { readonly type: 'not-an-object' }
  | { readonly type: 'missing-schema-version' }
  | { readonly type: 'newer-schema-version'; readonly version: number }
  | { readonly type: 'missing-migration'; readonly fromVersion: number }
  | { readonly type: 'invalid-project'; readonly issues: readonly string[] }

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function migrateToCurrent(
  raw: unknown,
  registry: MigrationRegistry = migrations,
  currentVersion: number = CURRENT_SCHEMA_VERSION,
): Result<JsonObject, LoadError> {
  if (!isJsonObject(raw)) return err({ type: 'not-an-object' })
  const version = raw['schemaVersion']
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return err({ type: 'missing-schema-version' })
  }
  if (version > currentVersion) return err({ type: 'newer-schema-version', version })

  let file = raw
  for (let from = version; from < currentVersion; from++) {
    const migration = registry[from]
    if (!migration) return err({ type: 'missing-migration', fromVersion: from })
    file = { ...migration(file), schemaVersion: from + 1 }
  }
  return ok(file)
}

/** Reads parsed JSON from a .rentang file: migrates it, then validates it. */
export function loadProjectFile(
  raw: unknown,
  registry: MigrationRegistry = migrations,
): Result<ProjectFile, LoadError> {
  const migrated = migrateToCurrent(raw, registry)
  if (!migrated.ok) return migrated
  const parsed = projectFileSchema.safeParse(migrated.value)
  if (!parsed.success) {
    return err({
      type: 'invalid-project',
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }
  return ok(parsed.data)
}
