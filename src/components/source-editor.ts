import { element, Signal, signal } from "../deps.ts";
import { localSources, Source } from "./use-booru.ts";
import { uploadFile } from "./upload.ts";
import { download } from "./download.ts";
import Window from "./window.ts";

export function SourceEditor(sourceEdit: Signal<boolean>) {
  Window({
    title: () => "source editor",
    show: sourceEdit,
    titleChildren() {
      element("button", {
        class: "icon download-json",
        title: "download sources",
        onClick() {
          download(
            `sources-${Date.now()}.json`,
            "application/json",
            JSON.stringify(localSources(), null, 2),
          );
        },
      });
    },
    children() {
      for (const source of localSources()) {
        SourceEdit(source);
      }
      AddSource();
    },
  });
}

function AddSource() {
  const name = signal("");
  const url = signal("");

  element("div", (attr) => {
    attr.class = "flex justify-content-space-betwee flex-gap-10";
    element("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      element("label", { textContent: "name:" });
      element("input", {
        class: "flex-1",
        name: "name",
        placeholder: "*Booru",
        value: name,
        onInput(ev) {
          name(ev.currentTarget.value);
        },
      });
    });

    element("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      element("label", { textContent: "url:" });
      element("input", {
        class: "flex-1",
        name: "url",
        value: url,
        onInput: (ev) => url(ev.currentTarget.value),
        placeholder: "https://...",
      });
    });

    element("div", (attr) => {
      attr.class = "flex";
      element("button", {
        class: "icon plus",
        title: "add source",
        disabled: () => !name() || !url(),
        onClick() {
          if (!name() || !url()) return;
          localSources(
            localSources().concat({
              name: name(),
              url: url(),
            }),
          );
          url("");
          name("");
        },
      });

      element("button", {
        class: "icon import",
        title: "import source",
        async onClick() {
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
        },
      });
    });
  });
}

function SourceEdit(source: Source) {
  element("div", (attr) => {
    attr.class = "flex justify-content-space-between flex-gap-10";

    element("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      element("label", { textContent: "name:" });
      element("input", {
        class: "flex-1",
        name: "name",
        value: source.name,
        placeholder: "*Booru",
        onInput(ev) {
          source.name = ev.currentTarget.value;
        },
      });
    });

    element("div", (attr) => {
      attr.class = "flex align-items-baseline width-100";
      element("label", { textContent: "url:" });
      element("input", {
        class: "flex-1",
        value: source.url,
        placeholder: "https://...",
        onInput(ev) {
          source.url = ev.currentTarget.value;
        },
      });
    });

    element("div", (attr) => {
      attr.class = "flex";
      element("button", {
        class: "icon check",
        title: "save source",
        onClick() {
          const newSource = { url: source.url, name: source.name };
          localSources(
            localSources()
              .filter(($) => $ !== source)
              .concat(newSource),
          );
        },
      });

      element("button", {
        class: "icon delete",
        title: "delete source",
        onClick() {
          localSources(localSources().filter(($) => $ !== source));
        },
      });
    });
  });
}
