import Booru from "../context.ts";
import {
  addElement,
  component,
  elementRef,
  onMount,
  signal,
  view,
} from "../deps.ts";
import { getSources } from "./use-booru.ts";
import { usePervert } from "./use-pervert.ts";
import { SourceEditor } from "./source-editor.ts";
import Tag from "./tag.ts";

const Navigation = component(() => {
  const { postTags, tags, page, search, url } = Booru;
  const showTags = signal(false);
  const sourceEdit = signal(false);
  const pervert = usePervert();

  addElement("nav", () => {
    const ref = elementRef()!;

    SourceEditor(sourceEdit);

    addElement("div", (attr) => {
      attr.class = "nav-top";
      addElement("div", (attr) => {
        attr.class = "flex align-items-center";

        view(() => {
          if (pervert() === false) return;
          addElement("button", (attr) => {
            attr.title = "choose image source";
            attr.name = "source";
            attr.type = "button";
            attr.class = "icon source z-index-1";
            addElement("div", (attr) => {
              attr.class = "sources";
              addElement("div", (attr) => {
                attr.title = "open source editor";
                attr.textContent = "source editor";
                attr.onClick = () => sourceEdit(!sourceEdit());
              });
              for (const source of getSources()) {
                addElement("div", (attr) => {
                  attr.active = () => source.url === url();
                  attr.textContent = source.name;
                  attr.onClick = () => url(source.url);
                });
              }
            });
          });
        });

        addElement("button", (attr) => {
          attr.class = "icon tags";
          attr.onClick = () => showTags(!showTags());
        });

        addElement("input", (attr) => {
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

        addElement("button", (attr) => {
          attr.title = "browse source";
          attr.name = "sourcecode";
          attr.type = "button";
          attr.class = "icon sourcecode";
          attr.onClick = () => {
            open("https://github.com/mini-jail/burauza", "_blank");
          };
        });
      });

      addElement("div", (attr) => {
        attr.class = "nav-paging";
        addElement("button", (attr) => {
          attr.class = "previous";
          attr.textContent = () => String(page() - 1);
          attr.disabled = () => page() <= 1;
          attr.onClick = () => page(page() - 1);
        });
        addElement("button", (attr) => {
          attr.class = "current";
          attr.disabled = true;
          attr.textContent = () => String(page());
        });
        addElement("button", (attr) => {
          attr.class = "next";
          attr.textContent = () => String(page() + 1);
          attr.onClick = () => page(page() + 1);
        });
      });
    });

    addElement("div", (attr) => {
      attr.class = "tag-list overflow-auto flex-1";
      attr.show = showTags;
      view(() => {
        const selectedTags = tags();
        const restTags = postTags().filter((tag) =>
          !selectedTags.includes(tag)
        );
        onMount(() => ref.scrollTo({ top: 0, behavior: "smooth" }));
        for (const tag of selectedTags) Tag(tag);
        for (const tag of restTags) Tag(tag);
      });
    });
  });
});

export default Navigation;
