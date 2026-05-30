/** Shared, token-driven control classes so buttons match across the app. */

const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

/** Filled accent button (primary action). */
export const btnPrimary = `inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

/** Bordered neutral button (secondary action). */
export const btnSecondary = `inline-flex items-center justify-center gap-2 rounded-md border border-line px-3 py-1.5 text-sm text-ink transition-colors hover:bg-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;

/** Square ghost icon button. */
export const iconButton = `inline-flex items-center justify-center rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${focus}`;

/** Inline text/name input. */
export const textInput =
  "w-full rounded-md border border-line-strong bg-bg px-2 py-1.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/30";
