import { element, elementRef, onMount } from "../deps.ts";
import Booru from "../context.ts";
import { load } from "./loading.ts";

export default function Posts() {
  const { posts, highlighted, select, loaded, size } = Booru;

  element("main", (attr) => {
    const ref = elementRef()!;
    attr.ready = () => size() <= loaded();
    load({
      on: () => size() <= loaded(),
      text: () => `loading posts ${loaded()}/${size()}`,
    });
    onMount(() => ref.scrollTo({ top: 0, behavior: "smooth" }));
    for (const post of posts()) {
      element("article", () => {
        element("img", {
          src: post.previewUrl,
          alt: post.previewUrl,
          onClick: () => select(post),
          onLoad: () => loaded(loaded() + 1),
          onError: () => loaded(loaded() + 1),
          onMouseOver: () => highlighted(post.tags),
          onMouseOut: () => highlighted(undefined),
        });
      });
    }
  });
}
