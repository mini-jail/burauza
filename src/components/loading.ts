import { addElement, render, signal, view } from "../deps.ts";

type LoadingProps = {
  on: () => boolean;
  text: () => string;
};

const loads = signal<Set<LoadingProps>>(new Set());

export function useLoading() {
  let timeoutId: number;
  render(document.body, () => {
    addElement("div", (attr) => {
      attr.class = "loading-wrapper";
      view(() => {
        for (const props of loads()) {
          addElement("div", (attr) => {
            attr.class = "loading";
            attr.textContent = props.text;
            attr.loading = () => {
              const result = props.on();
              clearTimeout(timeoutId);
              if (props.on()) {
                loads().delete(props);
                timeoutId = setTimeout(() => loads(($) => $!), 2000);
              }
              return result;
            };
          });
        }
      });
    });
  });
}

export function load(props: LoadingProps) {
  queueMicrotask(() => {
    loads(loads().add(props));
  });
}
