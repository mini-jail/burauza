import { component, render } from "./deps.ts";
import Navigation from "./components/navigation.ts";
import Preview from "./components/preview.ts";
import Posts from "./components/posts.ts";
import { useLoading } from "./components/loading.ts";

const App = component(() => {
  Navigation();
  Posts();
  Preview();
});

render(document.body, () => {
  useLoading();
  App();
});
