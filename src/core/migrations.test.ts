import { describe, expect, it } from 'vitest'
import {
  loadProjectFile,
  migrateToCurrent,
  migrations,
  type JsonObject,
  type MigrationRegistry,
} from './migrations.ts'
import { CURRENT_SCHEMA_VERSION } from './model.ts'
import { coffeeShopProject } from './test-utils/coffee-shop.ts'

// Fictional history: v1 stored `title`, v2 renamed it to `name`, v3 added `tags`.
const exampleRegistry: MigrationRegistry = {
  1: ({ title, ...rest }: JsonObject) => ({ ...rest, name: title }),
  2: (file: JsonObject) => ({ ...file, tags: [] }),
}

describe('migrateToCurrent', () => {
  it('applies every migration in order and stamps the version', () => {
    const result = migrateToCurrent({ schemaVersion: 1, title: 'Kedai' }, exampleRegistry, 3)
    expect(result).toEqual({ ok: true, value: { schemaVersion: 3, name: 'Kedai', tags: [] } })
  })

  it('starts from the version the file has', () => {
    const result = migrateToCurrent({ schemaVersion: 2, name: 'Kedai' }, exampleRegistry, 3)
    expect(result).toEqual({ ok: true, value: { schemaVersion: 3, name: 'Kedai', tags: [] } })
  })

  it('leaves a current file untouched', () => {
    const file = { schemaVersion: 3, name: 'Kedai', tags: ['kopi'] }
    expect(migrateToCurrent(file, exampleRegistry, 3)).toEqual({ ok: true, value: file })
  })

  it('refuses files from a newer Rentang', () => {
    expect(migrateToCurrent({ schemaVersion: 4 }, exampleRegistry, 3)).toEqual({
      ok: false,
      error: { type: 'newer-schema-version', version: 4 },
    })
  })

  it('reports a gap in the migration chain', () => {
    expect(migrateToCurrent({ schemaVersion: 1 }, { 2: (file) => file }, 3)).toEqual({
      ok: false,
      error: { type: 'missing-migration', fromVersion: 1 },
    })
  })

  it.each([null, 'text', [], 3])('refuses %j as a file', (raw) => {
    expect(migrateToCurrent(raw)).toEqual({ ok: false, error: { type: 'not-an-object' } })
  })

  it.each([{}, { schemaVersion: '1' }, { schemaVersion: 0 }, { schemaVersion: 1.5 }])(
    'refuses %j without a usable schema version',
    (raw) => {
      expect(migrateToCurrent(raw)).toEqual({
        ok: false,
        error: { type: 'missing-schema-version' },
      })
    },
  )

  it('has a migration for every version below the current one', () => {
    for (let version = 1; version < CURRENT_SCHEMA_VERSION; version++) {
      expect(migrations[version]).toBeTypeOf('function')
    }
  })
})

describe('loadProjectFile', () => {
  it('loads a current file', () => {
    const project = coffeeShopProject()
    const result = loadProjectFile(JSON.parse(JSON.stringify({ schemaVersion: 1, project })))
    expect(result).toEqual({ ok: true, value: { schemaVersion: 1, project } })
  })

  it('validates after migrating', () => {
    const result = loadProjectFile({ schemaVersion: 1, project: { name: 'Tanpa isi' } })
    expect(result.ok).toBe(false)
    if (result.ok || result.error.type !== 'invalid-project') return
    expect(result.error.issues).toContain(
      'project.id: Invalid input: expected string, received undefined',
    )
  })

  it('passes migration errors through', () => {
    expect(loadProjectFile({ schemaVersion: 99 })).toEqual({
      ok: false,
      error: { type: 'newer-schema-version', version: 99 },
    })
  })
})
