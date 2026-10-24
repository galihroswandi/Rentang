/**
 * Reads GanttProject XML (.gan) into a validated, still GanttProject-shaped structure.
 * Attribute values stay strings here; turning them into the Rentang model is map.ts's job.
 */
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { z } from 'zod'
import { err, ok, type Result } from '../result.ts'

const ARRAY_ELEMENTS = new Set([
  'task',
  'depend',
  'taskproperty',
  'customproperty',
  'date',
  'resource',
  'allocation',
  'previous-tasks',
  'roles',
  'role',
])

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  ignoreDeclaration: true,
  ignorePiTags: true,
  parseTagValue: false,
  parseAttributeValue: false,
  isArray: (name, _path, _isLeaf, isAttribute) => !isAttribute && ARRAY_ELEMENTS.has(name),
})

/** An element with no attributes and no content, such as `<resources/>`, parses as ''. */
const element = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? {} : value), schema)

const list = <T extends z.ZodType>(schema: T) => z.array(schema).default([])

const dependSchema = z.looseObject({
  id: z.string(),
  type: z.string().default('2'),
  difference: z.string().default('0'),
})

const customPropertySchema = z.looseObject({ 'taskproperty-id': z.string() })

export type GanTask = {
  id: string
  name: string
  start: string
  duration: string
  complete?: string | undefined
  meeting?: string | undefined
  webLink?: string | undefined
  notes?: string | undefined
  depend: z.infer<typeof dependSchema>[]
  customproperty: z.infer<typeof customPropertySchema>[]
  task: GanTask[]
}

const taskSchema: z.ZodType<GanTask> = z.lazy(() =>
  z.looseObject({
    id: z.string(),
    name: z.string().default(''),
    start: z.string(),
    duration: z.string(),
    complete: z.string().optional(),
    meeting: z.string().optional(),
    webLink: z.string().optional(),
    notes: z.string().optional(),
    depend: list(dependSchema),
    customproperty: list(customPropertySchema),
    task: list(taskSchema),
  }),
)

const weekdayFlag = z.string().optional()

const ganSchema = z.object({
  project: z.looseObject({
    name: z.string().default(''),
    calendars: element(
      z.looseObject({
        'day-types': element(
          z.looseObject({
            'default-week': element(
              z.looseObject({
                sun: weekdayFlag,
                mon: weekdayFlag,
                tue: weekdayFlag,
                wed: weekdayFlag,
                thu: weekdayFlag,
                fri: weekdayFlag,
                sat: weekdayFlag,
              }),
            ).optional(),
          }),
        ).optional(),
        date: list(
          element(
            z.looseObject({
              year: z.string().default(''),
              month: z.string().default(''),
              date: z.string().default(''),
              type: z.string().default('HOLIDAY'),
              '#text': z.string().default(''),
            }),
          ),
        ),
      }),
    ).default({ date: [] }),
    tasks: element(
      z.looseObject({
        taskproperties: element(
          z.looseObject({
            taskproperty: list(
              z.looseObject({ id: z.string(), name: z.string(), type: z.string().default('') }),
            ),
          }),
        ).default({ taskproperty: [] }),
        task: list(taskSchema),
      }),
    ),
    resources: element(
      z.looseObject({
        resource: list(
          z.looseObject({ id: z.string(), name: z.string(), function: z.string().optional() }),
        ),
      }),
    ).default({ resource: [] }),
    /** Custom roles; the built-in "Default" role set is referenced as "Default:<n>". */
    roles: list(
      element(z.looseObject({ role: list(z.looseObject({ id: z.string(), name: z.string() })) })),
    ),
    allocations: element(
      z.looseObject({
        allocation: list(z.looseObject({ 'task-id': z.string(), 'resource-id': z.string() })),
      }),
    ).default({ allocation: [] }),
    previous: element(
      z.looseObject({
        'previous-tasks': list(element(z.looseObject({ name: z.string().default('') }))),
      }),
    ).default({ 'previous-tasks': [] }),
  }),
})

export type GanDocument = z.infer<typeof ganSchema>['project']

export type GanParseError =
  | { readonly type: 'malformed-xml'; readonly message: string; readonly line: number }
  | { readonly type: 'not-a-gan-file' }
  | { readonly type: 'invalid-structure'; readonly issues: readonly string[] }

export function parseGan(xml: string): Result<GanDocument, GanParseError> {
  // XMLValidator is marked deprecated in favour of the fast-xml-validator package, but that
  // package pulls in a dependency that calls Buffer at load time and blanks the page in the
  // browser (Vite dev server). The deprecated validator works everywhere.
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    return err({ type: 'malformed-xml', message: validation.err.msg, line: validation.err.line })
  }

  const raw: unknown = parser.parse(xml)
  if (typeof raw !== 'object' || raw === null || !('project' in raw)) {
    return err({ type: 'not-a-gan-file' })
  }

  const parsed = ganSchema.safeParse(raw)
  if (!parsed.success) {
    return err({
      type: 'invalid-structure',
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    })
  }
  return ok(parsed.data.project)
}
