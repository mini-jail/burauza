import { element, elementRef, onMount } from "../deps.ts";
import Booru from "../context.ts";
import { load } from "./loading.ts";

function finishLoading() {
  Booru.loaded(Booru.loaded() + 1);
}

function unhighlight() {
  Booru.highlighted(undefined);
}

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
          onLoad: finishLoading,
          onError: finishLoading,
          onMouseOver: () => highlighted(post.tags),
          onMouseOut: unhighlight,
        });
      });
    }
  });
}
