// Copyright 2021 the Neunit team. All rights reserved. Neunit licence.

import { Edge, isBlank, toVertex, toArray } from "../deepgraph/mod.ts";
import { NotFound, PermissionDenied, Unknown } from "../errors/mod.ts";
import { load, Registration, Settings } from "./mod.ts";

/** 默认导出的构建函数。*/
export default function(config: LoaderConfig, root: Edge): Edge {
    return new Loader(config, root);
}

/** 可以被激活成 Active Vertex 的数据 */
export interface VertexData {
    /** 全局唯一的ID，用于注册。 */
    id?: string;
    /** 激活函数或者模块名。该模块默认导出激活函数。 */
    module?: string | [string, string];
    /** 异步初始化命令。
     * 如果是数组类型，则会被分解成invoke的参数。
     * 跟_config类似，用于初始化模块，但这个是异步初始化过程。
     * 可以避免同步初始化引起的死锁现象。
     */
    initialize?: boolean;
    /** 是否需要注册到Root */
    register?: boolean;
    /** 激活函数的配置参数。如果没有该项，整个VertexData会被作为配置参数 */
    config?: Settings;  // parameters for constructor.
    /** config不存在时，该VertexData实例作为config */
    [index: string]: unknown;
}

export interface Vertices {
    [id: string]: VertexData;
}

export interface LoaderConfig {
    name?: string;
    token?: string;
    vertices?: string | Vertices;
    register?: boolean;
}

const DEFAULT_LOADER_CONFIG: LoaderConfig = {
    name: "neunit",
    vertices: "vertices.js",
    register: true,
};

/** 整个Deepgraph的根。也是系统的初始位置。运行中各个模块可以设定自己的根。 */
export class Loader implements Edge {
    #vertices: Map<string, VertexData>;
    #root: Edge;
    #register: boolean;
    #name: string;
    #token?: string;
    #modules?: string;

    constructor(config: LoaderConfig, root: Edge) {
        const cfg = { ...DEFAULT_LOADER_CONFIG, ...config };
        const { name, token, vertices, register } = cfg;
        this.#root = root;
        this.#name = name as string;
        this.#token = token;
        this.#register = register as boolean;
        if (Array.isArray(vertices)) {
            this.#vertices = new Map(vertices);
        } else if (typeof vertices === "object") {
            this.#vertices = new Map(Object.entries(vertices));
        } else {
            this.#vertices = new Map;
            this.#modules = vertices;
        }
    }

    async initialize(vertices?: string): Promise<Edge> {
        vertices ??= this.#modules;
        if (vertices) {
            const data = await load(vertices);
            for (const [k, v] of Object.entries(data)) {
                this.#vertices.set(k, v as VertexData);
            }
        }
        return this;
    }

    /// Load data and activate vertex with registering on-demanded.
    async load(idOrData: string | VertexData, register?: boolean): Promise<Edge> {
        let data, name;
        if (typeof idOrData === "object") {
            data = idOrData;
        } else {
            const v = this.#vertices.get(idOrData);
            // make a data copy from repository
            if (v !== undefined) data = { ...v };
            name = idOrData;
        }
        if (data === undefined) throw new NotFound(`vertex with ID ${idOrData} is not found`);
        // if no builder provided, return data only.
        if (isBlank(data.module)) return toVertex(data);
        const [modName, builderName] = toArray(data.module);
        // load builder function
        const forge = await load(modName, builderName);
        let config = data.config;
        // if config is not present, full data as config.
        config ??= data;
        const vertex = await forge(config, this.#root);
        // if register is true, there is only one instance of the vertex.
        register ??= data.register ?? this.#register;
        if (register) {
            const id = data.id ?? name;
            const v: Registration = { vertex, id, token: this.#token };
            this.#root.set(v);
        }
        // async initialize on-demand
        if (data.initialize) await vertex.invoke("initialize");
        return vertex;
    }

    /** 获取内部参数或者从vertex表中获取数据。*/
    get(key: string): unknown {
        switch (key) {
            case "from": return this.#name;
            case "root": return this.#root;
            case "register": return this.#register;
            case "modules": return this.#modules;
            case "token": throw new PermissionDenied;
            default:
                return this.#vertices.get(key);
        }
    }

    /** 添加新的vertex数据 */
    set(value: VertexData, key: string): void {
        this.#vertices.set(key, value);
    }

    /** 异步执行初始化、加载及注册。
     * 
     * - 通用命令：
     *   - "initialize", 所有vertex都应该实现的异步初始化命令。
     *   - "load"，实例化vertex，根据配置决定是否全局注册。
     *   - "instantiate"，与 load 命令类似，总是会创建新的实例，不影响root注册表中已有实例。
     *   - "register"，实例化并强制全局注册，如果不提供id，则会生成新的uuid。
     *   - "deregister"，从root中注销。
     */
    async invoke(command: string, data: string | VertexData): Promise<unknown> {
        switch (command) {
            case "load": return this.load(data);
            case "register": return this.load(data, true);
            case "deregister": return this.#root.set(undefined, [this.#token, data]);
            case "instantiate": return this.load(data, false);
            case "initialize": return await this.initialize();
        }
        throw new Unknown(`unknown intent: ${command}`);
    }
}
