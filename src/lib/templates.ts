/** Built-in markdown templates + placeholder substitution for "New from template". */

export interface Template {
  /** Display name in the picker. */
  name: string;
  /** Raw body with `{{title}}` / `{{date}}` / `{{time}}` placeholders. */
  body: string;
}

/** Templates shipped with the app. Users can add their own as `.md` files in a
 * `templates/` folder in the vault (those appear alongside these). */
export const BUILT_IN_TEMPLATES: Template[] = [
  {
    name: "Daily note",
    body: `# {{date}}

## Tasks
- [ ]

## Notes


## Log
`,
  },
  {
    name: "Meeting notes",
    body: `# {{title}}

- **Date:** {{date}} {{time}}
- **Attendees:**

## Agenda
-

## Discussion


## Decisions
-

## Action items
- [ ]
`,
  },
  {
    name: "TODO list",
    body: `# {{title}}

## Today
- [ ]

## Soon
- [ ]

## Done
- [x]
`,
  },
];

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

/** Replace `{{title}}` / `{{date}}` / `{{time}}` in a template body. */
export function applyTemplate(body: string, vars: { title: string }): string {
  const now = new Date();
  return body
    .replace(/\{\{\s*title\s*\}\}/g, vars.title)
    .replace(/\{\{\s*date\s*\}\}/g, DATE_FMT.format(now))
    .replace(/\{\{\s*time\s*\}\}/g, TIME_FMT.format(now));
}
