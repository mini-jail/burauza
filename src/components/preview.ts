import { effect, element, onCleanup, signal } from "../deps.ts";
import Booru from "../context.ts";
import Window from "./window.ts";
import Tag from "./tag.ts";
import { load } from "./loading.ts";

const imageExtensions: string[] = [
  "jpg",
  "jpeg",
  "bmp",
  "png",
  "gif",
];

const getExtension = (filename: string) => {
  return filename.split(".").at(-1);
};

const isImage = (filename: string) => {
  const ext = getExtension(filename);
  if (ext === undefined) return false;
  return imageExtensions.includes(ext);
};

export default function Preview() {
  const { select, posts } = Booru;
  const show = signal(false);

  onCleanup(() => show(false));

  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowRight") showNext();
    else if (ev.key === "ArrowLeft") showPrevious();
  };

  const showPrevious = () => {
    const index = posts().indexOf(select()!);
    const prev = (index - 1) === -1 ? posts().length - 1 : index - 1;
    select(posts()[prev]);
  };

  const showNext = () => {
    const index = posts().indexOf(select()!);
    const next = (index + 1) === posts().length ? 0 : index + 1;
    select(posts()[next]);
  };

  Window({
    title: () => String(select()?.fileUrl),
    show: show,
    width: "100%",
    onOpen: () => addEventListener("keyup", onKeyUp),
    onClose: () => removeEventListener("keyup", onKeyUp),
    titleChildren() {
      element("button", { class: "icon left", onClick: showPrevious });
      element("button", { class: "icon right", onClick: showNext });
      element("button", {
        class: "icon curly-arrow",
        title: "open file in new tab",
        onClick: () => open(select()!.fileUrl, "_blank"),
      });
    },
    children() {
      element("div", (attr) => {
        attr.class = "preview";
        const post = select();
        if (post === undefined) return;
        load({ on: show, text: () => `loading "${post.id}"` });
        element("img", {
          class: "preview-img",
          src: isImage(post.fileUrl) ? post.fileUrl : post.previewUrl,
          alt: post.fileUrl,
          onLoad: () => show(true),
          onError: (ev) => {
            if (ev.currentTarget.src === post.fileUrl) {
              ev.currentTarget.src = post.previewUrl;
            }
          },
        });

        element("div", (attr) => {
          attr.class = "tag-list";
          for (const tag of post.tags) Tag(tag, post);
        });
      });
    },
  });
}
