export type EmitNow<T extends any> = (...args: any[]) => T;
export type Emit<T extends any> = (...args: any[]) => T | Promise<T>;

export
interface Sub<T extends any> {
  update: (val: T) => T;
  subscribe: Function;
  data: {
    value: T;
  };
  makeEmitNow: (cb?: EmitNow<T>) => (...args: any[]) => T;
  makeEmit: (cb?: Emit<T>) => (...args: any[]) => Promise<T>;
}

export
type setState<T extends any> = (newState: T) => void;
