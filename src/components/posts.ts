import { element, elementRef, onMount } from "../deps.ts";
import ctx from "../context.ts";
import { load } from "./loading.ts";

function finishLoading() {
  ctx.loaded(ctx.loaded() + 1);
}

function unhighlight() {
  ctx.highlighted(undefined);
}

export default function Posts() {
  const { posts, highlighted, select, loaded, size } = ctx;

  element("main", (attr) => {
    const ref = elementRef()!;
    attr.ready = () => size() <= loaded();

    load({
      on: () => size() <= loaded(),
      text: () => `loading posts ${loaded()}/${size()}`,
    });

    onMount(() => ref.scrollTo({ top: 0, behavior: "smooth" }));

    for (const post of posts()) {
      element("article", (attr) => {
        attr.dataId = post.id;
        attr.dataDimensions = post.dimensions.join("x");
        attr.onClick = () => select(post);
        attr.onMouseUp = (ev) => {
          ev.button === 1 && open(post.fileUrl, "_blank");
        };
        attr.onMouseOver = () => highlighted(post.tags);
        attr.onMouseOut = unhighlight;

        element("img", {
          src: post.previewUrl,
          alt: post.previewUrl,
          onLoad: finishLoading,
          onError: finishLoading,
        });
      });
    }
  });
}
