import { useEffect, useState } from "react";
import { cloneDeep, set, get } from "lodash";

export
function reflect(path = "", advanced?: boolean) {
  return function (_target: any, key: string, descriptor: any) {
    if (descriptor.value && typeof descriptor.value === 'function') {
      const originalMethod = descriptor.value;
      descriptor.value = function(...args: any[]) {
        this._path = path;
        const ret = this.update(originalMethod.call(this, ...args));
        const reArgs = [ret, this._path, ...args];
        this.echo("emit", key, ...reArgs);
        this.echo("emit " + key, ...reArgs);
        return ret;
      };
      return descriptor;
    }

    const originalSetter = descriptor.set;
    const originalGetter = descriptor.get;

    if (descriptor.hasOwnProperty('writable'))
      delete descriptor.writable;

    descriptor.set = function(value: any) {
      const remember = this._path;
      this._path = (path ? path + "." : "") + key;
      let args = [this._path, value];
      this.echo("pre set", key, ...args);
      this.echo("pre set " + key, ...args);
      this._target = value;

      if (originalSetter)
        originalSetter.call(this, value)

      if (this.diff(this._target, this._path))
        this.update(this._target, undefined, advanced);
      this._path = remember;
      args = [this._path, value, this._target, this._value];
      this.echo("set", key, ...args);
      this.echo("set " + key, ...args);
    };

    descriptor.get = function() {
      const remember = this._path;
      this._path = (path ? path + "." : "") + key;
      const ret = originalGetter ? originalGetter.call(this) : this.get(this._path);
      this._path = remember;
      this.echo("get", key, this._path, ret);
      this.echo("get " + key, this._path, ret);
      return ret;
    };

    return descriptor;
  };
}

interface Value {
  url?: string;
}

export
class Sub<T> {
  _subs = new Map();
  _value: T;
  _url: string = "default";
  _path: string;
  _target: any;
  _debug: string[] = [];
  _name: string = "Default";
  _suffix: string = "default";

  constructor(
    defaultData: T = { } as T,
    name: string = "Sub",
  ) {
    this._name = name;
    this._debug = (window.localStorage.getItem("@tty-pt/sub/" + name + "/debug") ?? "").split(",");
    this._value = defaultData;
  }

  echo(key: string, ret: any, ...args: any[]) {
    if (!this.debug)
      return ret;
    const map = this._debug.reduce((a, i) => ({ ...a, [i]: true }), {});
    if (map[key])
      console.log("@tty-pt/sub", this._name, key, ret || "?", ...args.map(arg => arg || "?"));
    return ret;
  }

  set suffix(value: string) {
    this._suffix = value;
  }

  get suffix() {
    return this._suffix;
  }

  get index() {
    return this._url + "/" + this._suffix;
  }

  isValidSuffix(_suffix: string) {
    return false;
  }

  pop(path: string) {
    const lioA = path.lastIndexOf(".");
    const lioB = path.lastIndexOf("/");
    const max = lioA > lioB ? lioA : lioB;
    if (max < 0)
      return path;
    else
      return path.substring(max + 1);
  }

  @reflect()
  set url(value: string) {
    this._target = this._url = value ? value.replace(".", "/") : "initial";
  }

  get url() {
    return (this._value as Value).url as string;
  }

  get value() {
    return this._value;
  }

  get debug() {
    return this._debug;
  }

  set debug(value: string[]) {
    this._debug = value;
    window.localStorage.setItem("@tty-pt/sub/" + this._name + "/debug", this._debug.join(","));
  }

  diff(obj: any, path: string = "") {
    const old = path ? get(this._value, path) : this._value;
    return old !== obj;
  }

  update(obj: T|any, path: string = this._path, advanced: boolean = false) {
    const resolved = this.replace(path);
    let change = false;
    this.echo("pre update", obj, path, resolved);

    change = obj !== this.get(path);
    const ret = this.set(obj, advanced ? "" : this.replace(path));

    for (const [sub, path] of this._subs) {
      const value = this.get(path, ret);
      const resolved = this.replace(path);
      if (this.diff(value, resolved)) {
        sub(value);
        change = true;
      }
    }

    if (change)
      this._value = ret;

    return this.echo("update", advanced ? this.get(path, ret) : ret, path, resolved, obj, ret, this._value);
  }

  current() {
    return this._value;
  }

  set(value: any, path: string = "") {
    const ret = path ? set(cloneDeep(this._value as any), path, value) : value;
    this.echo("global set", path, value, ret);
    return ret;
  }

  parse(key: string) {
    if (!key.startsWith("$"))
      return key;

    switch (key) {
      case "$url": return this._url + "/" + this._suffix;
      case "$suf": return this._suffix;
      default: return this._value[key];
    }
  }

  replace(path = this.index) {
    const keys = path.split('/').map(key => key.split(".").map(ckey => this.parse(ckey)).join("."));
    const realPath = keys.join("/");
    return this.echo("replace", realPath, path);
  }

  get(path: string = this._path, value: T = this._value) {
    value = value ?? this._value;
    const realPath = this.replace(path);
    return this.echo("global get", path ? get(value, realPath) : value, path, realPath, value);
  }

  subscribe(setValue: Function, path: string = "") {
    const sub = setValue;
    sub(this.get(path));
    this._subs.set(sub, path);
    return () => {
      this._subs.delete(sub);
    };
  }

  use(path = "") {
    const [value, setValue] = useState(this.get(path));
    useEffect(() => this.subscribe(setValue, path), [path]);
    return this.echo("use", value, path);
  }

  makeEmit(cb: Function = (a: any) => a, path: string = "") {
    return (...args: any[]) => {
      this.update(cb.call(this, ...args), path);
    }
  }
}
