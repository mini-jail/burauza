import { element, mount, signal } from "../deps.ts";

type LoadingProps = {
  on: () => boolean;
  text: () => string;
};

const loads = signal<Set<LoadingProps>>(new Set());

export function useLoading() {
  mount(document.body, () => {
    element("div", (attr) => {
      attr.class = "loading-wrapper";
      for (const props of loads()) {
        element("div", {
          class: "loading",
          textContent: props.text,
          loading: () => {
            const result = props.on();
            if (result) {
              loads().delete(props);
              loads(loads());
            }
            return result;
          },
        });
      }
    });
  });
}

export function load(props: LoadingProps) {
  queueMicrotask(() => loads(loads().add(props)));
}
