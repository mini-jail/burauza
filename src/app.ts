import { mount } from "./deps.ts";
import Navigation from "./components/navigation.ts";
import Preview from "./components/preview.ts";
import Posts from "./components/posts.ts";
import { useLoading } from "./components/loading.ts";

useLoading();

mount(document.body, () => {
  Navigation();
  Posts();
  Preview();
});
