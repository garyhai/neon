// Copyright 2021 the Neunit team. All rights reserved. Neunit licence.

import { v4 as uuid } from "https://deno.land/std@0.97.0/uuid/mod.ts";
import { isEdge, Edge } from "../deepgraph/mod.ts";
import { Forbidden, NotFound, Unavailable, Unknown } from "../errors/mod.ts";
import { log } from "../logger/mod.ts";

/** Vertex构建函数接口。 */
export interface Builder {
    (config?: unknown, root?: Edge): Edge;
}

/** 用于注册全局vertex的接口 */
export interface Registration {
    vertex: Edge;
    id?: string;
    token?: string;
}

/** 标准模块都要默认export一个creator。
 * @param args: 通常是配置项，用于初始化。
 */
export default function startup(args?: RootConfig): Edge {
    return new Root(args);
}

export interface Settings {
    [index: string]: unknown;
}

/** Root对象的初始数据参数 */
export interface RootConfig {
    /** 敏感操作所需的令牌 */
    token?: string;
    /** 持久化静态数据存储库，通常是数据库。默认直接使用配置对象 */
    loader?: string;
    /** loader configuration */
    loaderConfig?: Settings | string;
    /** 预加载的模块列表。默认还会从静态配置中加载带有"_id"属性的对象 */
    preloads?: string[];
}

const DEFAULT_CONFIG: RootConfig = {
    loader: "./loader.ts",
    loaderConfig: "modules.json",
};

/** 整个Deepgraph的根。也是系统的初始位置。运行中各个模块可以设定自己的根。 */
export class Root implements Edge {
    #config: RootConfig = DEFAULT_CONFIG;
    #registry: Map<string, Edge>;
    #loader?: Edge;

    constructor(config?: RootConfig) {
        this.#registry = new Map;
        if (config !== undefined) {
            this.#config = { ...this.#config, ...config };
        }
    }

    // initialize registry and repository then preload all vertices from configuration.
    async initialize(): Promise<Edge> {
        let config;
        if (typeof this.#config.loaderConfig === "string") {
            config = await load(this.#config.loaderConfig);
        } else {
            config = this.#config.loaderConfig;
        }
        config ??= {};
        if (this.#config.token !== undefined) {
            config["token"] ??= this.#config.token;
        }
        const loaderPath = config["module"] ?? this.#config.loader;
        const forge = await load(loaderPath);
        const loader = await forge(config, this);
        await loader.invoke("initialize");
        this.#loader = loader;
        const preloads = this.#config.preloads ?? [];
        for (const preload of preloads) {
            await loader.invoke("load", preload);
        }
        log.info("neunit system is started!");
        return this;
    }

    /** 从注册表中获取已经被加载并注册的对象。
     * @param key Vertex对象的全局ID
     * @returns 对象实例。对象不存在时不抛出异常，而是返回undefined
     */
    get(key: string): Edge | undefined {
        return this.#registry.get(key);
    }

    /** 注册或者注销全局对象。
     * @param value 待注册的对象。当值为undefined时，将会执行deregister操作。
     * @param key 注册的全局ID。不提供时，自动生成uuid作为新的key，并返回该key。
     * @returns 注册成功返回注册时的id；注销成功返回true；注销失败返回false。
     */
    set(value: Registration | Edge | undefined, path?: string[]): string | boolean {
        let [withToken, key] = path ?? [];
        if (value === undefined) {
            if (withToken !== this.#config.token) {
                throw new Forbidden("token is invalid");
            }
            return this.#registry.delete(key);
        }
        let vtx = undefined;
        if (isEdge(value)) {
            vtx = value;
        } else {
            const { vertex, id, token } = value as Registration;
            vtx = vertex;
            key ??= id!;
            withToken ??= token!;
        }
        if (withToken !== this.#config.token) {
            throw new Forbidden("token is invalid");
        }
        key ??= uuid.generate();
        this.#registry.set(key, vtx);
        return key;
    }

    /** 执行异步命令
     * @param command 初始化、加载及注册类命令。
     * @param options 承载额外的参数，注册时通常会有token和key值。
     * @returns 异步返回各种调用的结果。这里强制要求返回的数据具备Edge接口。
     */
    async invoke(command: string, data?: string | Edge | Registration, options?: Settings): Promise<unknown> {
        switch (command) {
            case "get":
            case "load": {
                const id = data as string;
                const vertex = this.#registry.get(id);
                if (vertex) return vertex;
                if (this.#loader) return this.#loader.invoke("load", data, options);
                throw new Unavailable("loader of root is not ready");
            }
            case "set":
            case "register": {
                if (isEdge(data)) {
                    const reg: Registration = { ...options, ...{ vertex: data } };
                    return this.set(reg);
                }
                return this.set(data as Registration);
            }
            case "delete":
            case "deregister": {
                const { token } = options ?? {};
                return this.set(undefined, [token as string, data as string]);
            }
            case "initialize": return await this.initialize();
        }
        throw new Unknown(`unknown intent: ${command}`);
    }
}


// deno-lint-ignore no-explicit-any
export async function load(modPath: string | string[], varName?: string): Promise<any> {
    if (Array.isArray(modPath)) {
        [modPath, varName] = modPath;
    }
    varName ??= "default";
    const module = await import(modPath);
    const v = module[varName];
    if (v === undefined) throw new NotFound(`${varName} is not exported from ${modPath}`);
    return v;
}