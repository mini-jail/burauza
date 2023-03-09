import { component, render } from "./deps.ts"
import Navigation from "./components/navigation.ts"
import Preview from "./components/preview.ts"
import Posts from "./components/posts.ts"

const App = component(() => {
  Navigation()
  Posts()
  Preview()
})

const _cleanup = render(document.body, () => {
  App()
})
