import { effect, onDestroy } from "../deps.ts";

export function useTitle(title: () => string) {
  const previousTitle = document.title;
  effect(() => document.title = title());
  onDestroy(() => document.title = previousTitle);
}
