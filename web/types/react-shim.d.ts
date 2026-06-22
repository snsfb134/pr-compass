declare namespace React {
  type ReactNode = any;
  type ComponentType<P = any> = any;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: string | number;
  }

  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
