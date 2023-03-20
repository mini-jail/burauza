import { element, mount, signal } from "../deps.ts";

type LoadingProps = {
  on: () => boolean;
  text: () => string;
};

const loads = signal<Set<LoadingProps>>(new Set());

export function useLoading() {
  let timeoutId: number;
  mount(document.body, () => {
    element("div", (attr) => {
      attr.class = "loading-wrapper";
      for (const props of loads()) {
        element("div", {
          class: "loading",
          textContent: props.text,
          loading: () => {
            const result = props.on();
            clearTimeout(timeoutId);
            if (props.on()) {
              loads().delete(props);
              timeoutId = setTimeout(() => loads(loads()), 2000);
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
