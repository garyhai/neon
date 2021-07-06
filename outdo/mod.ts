// Copyright 2021 the Neunit team. All rights reserved. Neunit license.

import { Edge } from "../deepgraph/mod.ts";
import { AlreadyExists, Unknown } from "../errors/mod.ts";

import {
  extname,
  format,
  FormatInputPathObject,
  join,
  resolve,
} from "https://deno.land/std@0.100.0/path/mod.ts";

export function load(filename: string): number {
  return Deno.openPlugin(filename);
}

export function unload(rid: number): void {
  Deno.close(rid);
}

export interface OutdoConfig {
  root?: string;
  dir?: string;
  ext?: string;
  bases?: string[];
  names?: string[];
}

const DFL_CONFIG = { dir: "./dist/outdoes" };

export class Outdo implements Edge {
  #outdoes: Map<number, string>;
  #config: OutdoConfig;

  constructor(config?: OutdoConfig | string) {
    if (typeof config === "string") {
      this.#config = { dir: config };
    } else if (config) {
      this.#config = config;
    }
    this.#config ??= DFL_CONFIG;
    this.#outdoes = new Map();
  }

  get(key: string | number): unknown {
    if (typeof key === "number") {
      return this.#outdoes.get(key);
    }
    switch (key) {
      case "config":
      case "configuration":
        return this.#config;
      case "resources":
      case "plugins":
        return [...this.#outdoes.keys()];
      default: {
        return this.#config[key as keyof OutdoConfig];
      }
    }
  }

  set(value: string, key: string): boolean {
    switch (key) {
      case "file": {
        const rid = load(value);
        this.#outdoes.set(rid, value);
        break;
      }
      case "name": {
        const { root, dir, ext } = this.#config;
        const filepath = makeFullPath({ root, dir, ext, name: value });
        this.#outdoes.set(load(filepath), filepath);
        break;
      }
    }
    return true;
  }

  async invoke(intent: string, data?: string | number): Promise<unknown> {
    switch (intent) {
      case "initialize":
        if (this.#outdoes.size > 0) {
          throw new AlreadyExists("already loaded");
        }
        return await this.initialize();
      case "uninitialize":
        return this.uninitialize();
      case "loadFile":
        this.set(data as string, "file");
        return 1;
      case "load":
        this.set(data as string, "name");
        return 1;
      case "unload":
        unload(data as number);
        return this.#outdoes.delete(data as number) ? 1 : 0;
      default:
        throw new Unknown(`unknown intent: ${intent}`);
    }
  }

  uninitialize(): number {
    this.#outdoes.forEach((_, id) => unload(id));
    const count = this.#outdoes.size;
    this.#outdoes.clear();
    return count;
  }

  async initialize(): Promise<number> {
    let count = 0;
    const { bases, names, ...path } = this.#config;

    bases?.forEach((base) => {
      const po = { ...path, ...{ base } };
      const file = makeFullPath(po);
      this.#outdoes.set(load(file), file);
      count++;
    });

    names?.forEach((name) => {
      const po = { ...path, ...{ name } };
      const file = makeFullPath(po);
      this.#outdoes.set(load(file), file);
      count++;
    });

    if (count === 0) {
      const libPath = resolve(path.root ?? "", path.dir ?? "");
      for await (const entry of Deno.readDir(libPath)) {
        if (entry.isFile) {
          if (path.ext && extname(entry.name) !== path.ext) continue;
          const file = join(libPath, entry.name);
          this.#outdoes.set(load(file), file);
          count++;
        }
      }
    }

    return count;
  }
}

export function makeFullPath(config: FormatInputPathObject | string): string {
  if (typeof config === "string") {
    return config;
  }
  let { base, ext, name } = config;
  if (base == undefined) {
    if (name == undefined) return "";
    if (ext == undefined) {
      switch (Deno.build.os) {
        case "windows":
          ext = ".dll";
          break;
        case "darwin":
          ext = ".dylib";
          break;
        case "linux":
          ext = ".so";
          break;
        default:
          ext = ".so";
      }
    }
    config.base = `lib${name}${ext}`;
  }
  return format(config);
}
