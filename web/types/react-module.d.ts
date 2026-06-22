declare module "react" {
  export type ReactNode = any;
  export type ComponentType<P = any> = any;
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
  export function useState<T>(initial: T | (() => T)): [T, (value: T) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: unknown[]): T;
}
