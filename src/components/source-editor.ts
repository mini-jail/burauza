import { addElement, component, Signal, signal } from "../deps.ts";
import { localSources, Source } from "./use-booru.ts";
import { uploadFile } from "./upload.ts";
import { download } from "./download.ts";
import Window from "./window.ts";

export const SourceEditor = component((sourceEdit: Signal<boolean>) => {
  Window({
    title: () => "source editor",
    show: sourceEdit,
    titleChildren() {
      addElement("button", (attr) => {
        attr.class = "icon download-json";
        attr.title = "download sources";
        attr.onClick = () =>
          download(
            `sources-${Date.now()}.json`,
            "application/json",
            JSON.stringify(localSources(), null, 2),
          );
      });
    },
    children() {
      for (const source of localSources()) {
        SourceEdit(source);
      }
      AddSource();
    },
  });
});

const AddSource = component(() => {
  const name = signal("");
  const url = signal("");

  addElement("div", (attr) => {
    attr.class = "flex justify-content-space-betwee flex-gap-10";

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      addElement("label", (attr) => attr.textContent = "name:");
      addElement("input", (attr) => {
        attr.class = "flex-1";
        attr.name = "name";
        attr.value = name;
        attr.onInput = (ev) => name(ev.currentTarget.value);
        attr.placeholder = "*Booru";
      });
    });

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      addElement("label", (attr) => attr.textContent = "url:");
      addElement("input", (attr) => {
        attr.class = "flex-1";
        attr.name = "url";
        attr.value = url;
        attr.onInput = (ev) => url(ev.currentTarget.value);
        attr.placeholder = "https://...";
      });
    });

    addElement("div", (attr) => {
      attr.class = "flex";
      addElement("button", (attr) => {
        attr.class = "icon plus";
        attr.title = "add source";
        attr.disabled = () => !name() || !url();
        attr.onClick = () => {
          if (!name() || !url()) return;
          localSources(
            localSources().concat({
              name: name(),
              url: url(),
            }),
          );
          url("");
          name("");
        };
      });

      addElement("button", (attr) => {
        attr.class = "icon import";
        attr.title = "import source";
        attr.onClick = async () => {
          const data = await uploadFile(".json", "readAsText");
          const json = JSON.parse(data);
          const importedSources: Source[] = [];
          if (Array.isArray(json)) {
            for (const source of json) {
              if (source.name && source.url) {
                importedSources.push(source);
              }
            }
          }
          localSources(localSources().concat(importedSources));
        };
      });
    });
  });
});

const SourceEdit = component((source: Source) => {
  addElement("div", (attr) => {
    attr.class = "flex justify-content-space-between flex-gap-10";

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      addElement("label", (attr) => attr.textContent = "name:");
      addElement("input", (attr) => {
        attr.class = "flex-1";
        attr.name = "name";
        attr.value = source.name;
        attr.placeholder = "*Booru";
        attr.onInput = (ev) => source.name = ev.currentTarget.value;
      });
    });

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      addElement("label", (attr) => attr.textContent = "url:");
      addElement("input", (attr) => {
        attr.class = "flex-1";
        attr.value = source.url;
        attr.placeholder = "https://...";
        attr.onInput = (ev) => source.url = ev.currentTarget.value;
      });
    });

    addElement("div", (attr) => {
      attr.class = "flex";
      addElement("button", (attr) => {
        attr.class = "icon check";
        attr.title = "save source";
        attr.onClick = () => {
          const newSource = { url: source.url, name: source.name };
          localSources(
            localSources()
              .filter(($) => $ !== source)
              .concat(newSource),
          );
        };
      });

      addElement("button", (attr) => {
        attr.class = "icon delete";
        attr.title = "delete source";
        attr.onClick = () => {
          localSources(localSources().filter(($) => $ !== source));
        };
      });
    });
  });
});
