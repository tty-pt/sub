import { cloneDeep, set, get } from "lodash";

export
function emit(path = "") {
  return function emit(_target: any, propertyKey: string, descriptor: any) {
    const originalMethod = descriptor.value;

    descriptor.value = function(...args: any[]) {
      this._path = path;
      const ret = this.update(originalMethod.call(this, ...args), path);
      const reArgs = [ret, this._path, ...args];
      this.echo("emit", propertyKey, ...reArgs);
      this.echo("emit " + propertyKey, ...reArgs);
      return ret;
    };

    return descriptor;
  }
}

export
function reflect(path = "", advanced?: boolean) {
  return function (_target: any, key: string, descriptor: any) {
    const originalSetter = descriptor.set;
    const originalGetter = descriptor.get;

    if (descriptor.hasOwnProperty('value'))
      delete descriptor.value;

    if (descriptor.hasOwnProperty('writable'))
      delete descriptor.writable;

    descriptor.set = function(value: any) {
      this._path = (path ? path + "." : "") + key;
      let args = [this._path, value];
      this.echo("pre set", key, ...args);
      this.echo("pre set " + key, ...args);
      this._target = value;

      if (originalSetter)
        originalSetter.call(this, value)

      this.update(this._target, this._path, advanced);
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
  url: string;
}

export
class Sub<T extends Value> {
  _subs = new Map();
  _value: T;
  _react: any;
  _url: string = "initial";
  _path: string;
  _target: any;
  _debug: string[] = [];
  _name: string = "Default";
  _suffix: string;

  constructor(
    name: string,
    defaultData: T,
    react: any,
  ) {
    this._name = name;
    this._debug = (window.localStorage.getItem("@tty-pt/sub/" + name + "/debug") ?? "").split(",");
    this._value = defaultData;
    this._react = react;
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

  reindex(path: string, obj?: any) {
    const resolved = this.replace(path, obj ?? this.get(path));
    const io = resolved.indexOf(".");
    const len = io < 0 ? resolved.length : io;
    return this.replace(io < 0 ? resolved : resolved.substring(0, len));
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
    return this._value.url;
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

  update(obj: T|any, path: string = "", advanced: boolean = false) {
    const resolved = this.replace(path, obj);
    let change = false;
    this.echo("pre update", obj, path, resolved);

    change = obj !== this.get(path);
    const ret = this.set(obj, advanced ? "" : this.replace(path, obj));

    for (const [sub, path] of this._subs) {
      const value = this.get(path, ret);
      const resolved = this.replace(path, value);
      if (this.diff(value, resolved)) {
        sub(value);
        change = true;
      }
    }

    if (change)
      this._value = ret;

    this.echo("update", path, resolved, obj, ret, this._value);
    return advanced ? this.get(path, obj) : obj;
  }

  current() {
    return this._value;
  }

  set(value: any, path: string = "") {
    const ret = path ? set(cloneDeep(this._value as any), path, value) : value;
    this.echo("global set", path, value, ret);
    return ret;
  }

  parse(key: string, data: any) {
    if (!key.startsWith("$"))
      return key;

    switch (key) {
      case "$url": return this._url + "/" + this._suffix;
      case "$suf": return this._suffix;
      default: return data?.[key];
    }
  }

  replace(path = "", value?: any) {
    const data = this.set(value, path);
    const keys = path.split('/').map(key => key.split(".").map(ckey => this.parse(ckey, data)).join("."));
    return this.echo("replace", keys.join("/"), data, path);
  }

  get(path = "", value ?: any) {
    value = value ?? this._value;
    const realPath = this.replace(path, value);
    return realPath ? get(value, realPath.replace(".", "/")) : value;
  }

  use(path = "") {
    const [value, setValue] = this._react.useState(this.get(path));

    this._react.useEffect(() => {
      const sub = setValue;
      sub(this.get(path));
      this._subs.set(sub, path);
      return () => {
        this._subs.delete(sub);
      };
    }, [path]);

    return this.echo("use", value, path);
  }
}
