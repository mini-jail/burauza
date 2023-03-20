import Booru from "../context.ts";
import { element, signal } from "../deps.ts";
import { getSources } from "./use-booru.ts";
import { usePervert } from "./use-pervert.ts";
import { SourceEditor } from "./source-editor.ts";
import Tag from "./tag.ts";

export default function Navigation() {
  const { postTags, tags, page, search, url } = Booru;
  const showTags = signal(false);
  const sourceEdit = signal(false);
  const pervert = usePervert();

  element("nav", () => {
    SourceEditor(sourceEdit);

    element("div", (attr) => {
      attr.class = "nav-top";
      element("div", (attr) => {
        attr.class = "flex align-items-center";

        if (pervert()) {
          element("button", (attr) => {
            attr.title = "choose image source";
            attr.name = "source";
            attr.type = "button";
            attr.class = "icon source z-index-1";
            element("div", (attr) => {
              attr.class = "sources";
              element("div", {
                title: "open source editor",
                textContent: "source editor",
                onClick: () => sourceEdit(!sourceEdit()),
              });
              for (const source of getSources()) {
                element("div", {
                  active: () => source.url === url(),
                  textContent: source.name,
                  onClick: () => url(source.url),
                });
              }
            });
          });
        }

        element("button", {
          class: "icon tags",
          onClick: () => showTags(!showTags()),
        });

        element("input", (attr) => {
          attr.class = "flex-1";
          attr.name = "search";
          attr.placeholder = "search...";
          attr.value = search;
          attr.type = "text";
          let id: number;
          attr.onKeyUp = (ev) => {
            const value = ev.currentTarget.value;
            clearTimeout(id);
            id = setTimeout(() => search(value), 1000);
          };
        });

        element("button", {
          title: "browse source",
          name: "sourcecode",
          type: "button",
          class: "icon sourcecode",
          onClick() {
            open("https://github.com/mini-jail/burauza", "_blank");
          },
        });
      });

      element("div", (attr) => {
        attr.class = "nav-paging";
        element("button", {
          class: "previous",
          textContent: () => String(page() - 1),
          disabled: () => page() <= 1,
          onClick: () => page(page() - 1),
        });
        element("button", {
          class: "current",
          disabled: true,
          textContent: () => String(page()),
        });
        element("button", {
          class: "next",
          textContent: () => String(page() + 1),
          onClick: () => page(page() + 1),
        });
      });
    });

    element("div", (attr) => {
      attr.class = "tag-list overflow-auto flex-1";
      attr.show = showTags;
      const selectedTags = tags();
      const restTags = postTags().filter((tag) => !selectedTags.includes(tag));
      for (const tag of selectedTags) Tag(tag);
      for (const tag of restTags) Tag(tag);
    });
  });
}
