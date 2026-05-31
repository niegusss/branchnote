/** Keyboard helpers shared by the app's custom popover menus, so they're usable
 *  without a mouse (Arrow keys move focus, Home/End jump to the ends). */
import type { KeyboardEvent } from "react";

/** Roving focus over a menu's `[role="menuitem"]` children. Attach to the menu
 *  container's `onKeyDown`. Wraps around at both ends. */
export function menuKeyDown(e: KeyboardEvent<HTMLElement>): void {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
  const items = Array.from(
    e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  );
  if (items.length === 0) return;
  e.preventDefault();
  const active = document.activeElement as HTMLElement | null;
  const idx = active ? items.indexOf(active) : -1;
  let next: number;
  switch (e.key) {
    case "ArrowDown":
      next = idx < 0 ? 0 : (idx + 1) % items.length;
      break;
    case "ArrowUp":
      next = idx <= 0 ? items.length - 1 : idx - 1;
      break;
    case "Home":
      next = 0;
      break;
    default:
      next = items.length - 1; // End
  }
  items[next].focus();
}

/** Focus the first menu item. Use as a `ref` on the menu container so focus
 *  lands inside when it mounts (the stable identity means it fires once). */
export function focusFirstItem(el: HTMLElement | null): void {
  el?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
}
