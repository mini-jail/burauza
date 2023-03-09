import { effect, onCleanup, Signal, signal } from "../deps.ts"

export function usePervert(): Signal<boolean> {
  const init = localStorage.getItem("is:pervert") === "true"
  const codes = "imapervert".split("")
  const pervert = signal(init)
  let index = 0
  const onKeyUp = ({ key }: KeyboardEvent) => {
    if (index === codes.length - 1) {
      localStorage.setItem("is:pervert", "true")
      pervert(true)
      return
    }
    if (
      key != null &&
      codes[index] != null &&
      key.toLowerCase() === codes[index].toLowerCase()
    ) {
      index++
    } else {
      index = 0
      pervert(false)
    }
  }
  effect(() => {
    onCleanup(() => removeEventListener("keyup", onKeyUp))
    if (pervert()) return
    addEventListener("keyup", onKeyUp)
  })
  return pervert
}
