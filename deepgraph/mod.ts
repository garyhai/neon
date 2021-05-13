// Copyright 2021 the Neunit team. All rights reserved. MIT license.

// deno-lint-ignore-file require-await no-explicit-any

/** 基于Hypergraph模型的统一接口定义
 * 
 * 这套接口模型虽然是基于hypergraph的，但是为了编程建模方便，对其进行了特殊的改造。在此我们称之为deepgraph模型。
 * 在deepgraph模型中，edge（hyperedge）是最基本元素，hypergraph, hyperedge, vertex均被视为edge。
 * vertex通常被视为包裹了不可分割的完整数据的edge。而edge则是vertex的集合，是一个容器。不过对于property graph，vertex与edge的概念很模糊了。
*/

/** 对应hypergraph的hyperedge，deepgraph模型的最基本元素
 * 
 * 其中get/set用于简单的同步数据获取，侧重于效率；invoke用于复杂、耗时长的交互，强制要求异步实现。
 */
export interface Edge {
    /** 获取edge中的数据，path可以是数组用于获取更深层次的数据。 */
    get?(path: unknown): unknown;
    /** 设置数据。Edge对象可以自行解释value内容。path是可选的层次数据结构操作路径。 */
    set?(value: unknown, path?: unknown): unknown;
    /** 异步操作
     * 
     * 相对于get/set的同步数据操作，invoke是通用的异步函数调用。
     */
    invoke(intent: unknown, data?: unknown, options?: unknown): Promise<unknown>;
}

/** Base class of kinds of vertices
 * 
 * Graph/Edge/Vertex是三位一体的，不过我们还是认为Vertex会具象一些，但还不是最终的对象。
 * 因此Edge使用最abstract的interface，Vertex则使用abstract class。
 * graph则若隐若现于Vertex中。而实际使用上多以domain形式存在于Vertex内部。
 * 
 * Vertex即是Edge，需要体现“集合”特性。因此Vertex实现了Iterator作为通用的collection行为。
 */
export abstract class Vertex implements Edge {
    static isVertex(v: unknown) {
        return v instanceof Vertex;
    }

    get(_path: unknown): unknown {
        return undefined;
    }

    set(_value: unknown, _path?: unknown): unknown {
        throw new Error("'set' method is unimplemented");
    }

    async invoke(directive: unknown, data?: unknown, _options?: unknown): Promise<unknown> {
        const [intent, ...path] = toArray(directive);
        if (intent === "get") return this.get(path);
        if (intent === "set") return this.set(data, path);
        throw new Error(`unknown intent: ${intent}`);
    }
}

/** 作为property graph模型的vertex
 * 
 * 单一值的Vertex被成为纯量scalar，可以被视为只有一个元素的Edge。
 * 当包含复合数据结构时，如数组、对象等等，Vertex被称为vector。
 * Vector是矢量，也有reference的意思。通常是一个容器。
 * 整个替换掉某个verteor值时，需要在其上级容器中操作。不过Vector类提供了公开方法直接操作inner。
 * 整体设计采用了速错的非防御编程模式，非容器对象被深度索引时直接抛出异常。
*/
export class Vector extends Vertex {
    /** 内部被封装的原始复合数据。默认是对一般性Object的封装。 */
    inner: any;

    constructor(inner: any) {
        super();
        this.inner = inner;
    }

    /** 默认的枚举器枚举一般对象中成员。只支持对象中可以枚举属性。异步枚举器会自动调用同步枚举器 */
    *[Symbol.iterator]() {
        let items: Iterable<unknown>;
        if (typeof this.inner[Symbol.iterator] === "function") {
            items = this.inner;
        } else {
            items = Object.entries(this.inner);
        }
        for (const item of items) yield item;
    }

    async *[Symbol.asyncIterator]() {
        for (const item of this) yield item;
    }

    /** 多层次树状结构数据获取。 */
    deepGet(path: Array<string | number>): unknown {
        const [head, ...tail] = path;
        if (head == undefined) {
            // Skip undefined keys.
            if (tail.length) return this.deepGet(tail);
            // 此时的返回值不一定有 "Edge Interface"。
            return this.inner;
        }
        const next = this.inner[head];
        if (!tail.length) return next;
        // Vertex封装的目的是为了统一化操作。
        return toVertex(next).get(tail);
    }

    /** 多层次树状结构数据更改。 */
    deepSet(value: unknown, path: Array<string | number>): unknown {
        const k = path.pop();
        if (k == undefined) {
            if (path.length) {
                return this.deepSet(value, path);
            } else {
                Object.assign(this.inner, value);
                return undefined;
            }
        }
        if (path.length) {
            const last: any = this.deepGet(path);
            last[k] = value;
            return k;
        }
        this.inner[k] = value;
        return k;
    }

    /** 数据读取，支持层次路径。 */
    get(path?: unknown): unknown {
        if (Array.isArray(path)) return this.deepGet(path);
        if (path == undefined) return this.inner;
        return this.inner[path as string | number];
    }

    /** 更改数据，支持层次路径。 */
    set(value: unknown, path?: unknown): unknown {
        if (Array.isArray(path)) return this.deepSet(value, path);
        if (path == undefined) {
            this.inner = value;
        } else {
            this.inner[path as string | number] = value;
        }
        // 返回最终的键值
        return path;
    }

    /** 异步请求会中继给封装对象或者路径指向的对象。 */
    async invoke(intent: unknown, data?: unknown, options?: unknown): Promise<unknown> {
        if (isEdge(this.inner)) {
            return this.inner.invoke(intent, data, options);
        }
        return super.invoke(intent, data, options);
    }
}

/** 对有Hash表内部结构的Map进行特异化封装，把对对象属性访问改为对哈希表的访问，同时支持为不提供键值的插入操作生成新的键。 */
export class MapVector extends Vector {
    /** 新键生成函数。 */
    protected generateKey?(): unknown;
    declare inner: Map<unknown, unknown>;

    constructor(inner: Map<unknown, unknown>, generator?: () => unknown) {
        super(inner);
        if (generator) this.generateKey = generator;
    }

    /** 设置键值生成器。 */
    set keyGenerator(generator: () => unknown) {
        this.generateKey = generator;
    }

    /** 从哈希表中获取数据，支持层次路径。 */
    get(path?: unknown): unknown {
        if (Array.isArray(path)) return this.deepGet(path);
        if (path == undefined) return this.inner;
        return this.inner.get(path);
    }

    /** 更改或者插入数据。当path值为空时，如果有键生成器，则会为其生成唯一键值并插入哈希表。 */
    set(value: unknown, path?: unknown): unknown {
        if (Array.isArray(path)) return this.deepSet(value, path);
        if (path == undefined && this.generateKey) {
            path = this.generateKey();
        }
        if (path == undefined) throw new Error("Key or key generator is not defined.");
        if (value === undefined) {
            // delete operation when value is undefined (not null).
            return this.inner.delete(path);
        }
        this.inner.set(path, value);
        return path;
    }
}

/** 数组的特异化封装。不提供索引值的set操作会以push方式压入数组。 */
export class ArrayVector extends Vector {
    declare inner: Array<unknown>;
    constructor(inner: Array<unknown>) {
        super(inner);
    }

    /** 支持层次路径的数值读取，第一级索引为数组下标。 */
    get(path?: any): unknown {
        if (Array.isArray(path)) return this.deepGet(path);
        if (path == undefined) return this.inner;
        return this.inner[path];
    }

    /** 数组的插入和删除操作做特殊处理。删除操作会移动数组元素，并返回被删除的值。*/
    set(value: unknown, path?: any): any {
        if (Array.isArray(path)) return this.deepSet(value, path);
        if (path == undefined) {
            this.inner.push(value);
            return this.inner.length - 1;
        }
        if (value === undefined) {
            const [old] = this.inner.splice(path);
            return old;
        }
        this.inner[path] = value;
        return path;
    }
}

/** 纯量的Vertex封装。 */
export class Scalar extends Vertex {
    inner: unknown;
    constructor(inner: unknown) {
        super();
        this.inner = inner;
    }

    /** 取值 */
    get(path: unknown = undefined): unknown {
        if (path !== undefined) return undefined;
        return this.inner;
    }

    /** 赋值 */
    set(value: unknown): unknown {
        this.inner = value;
        return true;
    }

    /** 兼容异步请求，只返回其本身。 */
    async invoke(_intent: unknown): Promise<undefined> {
        return undefined;
    }
}


/** 根据提供的数据类型进行合适的Vertex封装。 */
export function toVertex(x: any): Vertex {
    if (Vertex.isVertex(x)) return x;
    if (x instanceof Map) return new MapVector(x);
    if (Array.isArray(x)) return new ArrayVector(x);
    if (typeof x === "object") return new Vector(x);
    return new Scalar(x);
}

/** 当前只根据函数中是否有 invoke 函数来判定，过于简单粗暴。 */
export function isEdge(x: any): x is Edge {
    if (x == null) return false;
    return (typeof x["invoke"] === "function");
}

/** 用于判断变量是否为空值（不仅仅是null）
 * 
 * 用于判断对象是否为空，包括空数组、空对象、空字符串。
 * 注意：数字0并不为空。
 * @param v 待判断的变量
 */
export function isBlank(v: unknown): boolean {
    if (v == null) return true;
    if (typeof (v) === "string" || Array.isArray(v)) {
        if (v.length === 0) return true;
        return false;
    }
    if (typeof v !== "object") {
        return false;
    }
    for (const _ in v) {
        return false;
    }
    return true;
}

/** Merge object with new data only exited enumerable properties.
 * 
 * @param data original data to update
 * @param newData partial new data
 */
export function updateObject(data: Record<string, unknown>, newData: Record<string, unknown>, properties?: string[]): Record<string, unknown> {
    if (newData == null) return data;
    properties ??= Object.keys(data);
    for (const key in newData) {
        if (properties.includes(key)) {
            data[key] = newData[key];
        }
    }
    return data;
}

/** Helper function, wrap as array. */
export function toArray(v: unknown): unknown[] {
    if (Array.isArray(v)) return v;
    if (v == null) return [];
    return [v];
}
