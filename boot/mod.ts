// Copyright 2021 the Neunit team. All rights reserved. Neunit licence.

import { Edge } from "../deepgraph/mod.ts";
import { AlreadyExists, InvalidData, Unavailable, Unknown} from "../errors/mod.ts";

/** 默认导出的构建函数。与其他模块不同的是，Boot模块没有根域。 */
export default function startup(args?: string | BootConfig): Edge {
    return new Boot(args);
}

export interface BootConfig {
    name?: string;
    loader?: string;
    preloads?: string[];
    [name: string]: unknown;
}

/** Boot 也是一个deepedge，只是没有根域。 */
export class Boot implements Edge {
    // 系统实例
    #loader?: Edge;
    // 内部配置
    #cfgFile?: string;
    #config?: BootConfig;

    /** 构造时要传入解析好的配置。*/
    constructor(config?: string | BootConfig) {
        // 传入配置参数优先级最高，其次是命令行参数中的配置文件路径，最后是环境变量。
        config ??= Deno.args[2];
        config ??= Deno.env.get("NE_CONFIG_FILE") ?? "neunit.json";
        if (typeof config === "string") {
            this.#cfgFile = config;
        } else {
            this.#config = config;
        }
    }

    /** 如果config参数不为空，则会覆盖原有配置项。这个设计是为了未来能够在运行时动态启动。*/
    async start(config?: string | BootConfig): Promise<unknown> {
        if (this.#loader) throw new AlreadyExists("Already started");
        if (typeof config === "string") {
            this.#cfgFile = config;
            this.#config = undefined;
        } else if (config) {
            this.#config = config;
            this.#cfgFile = undefined;
        }

        // 加载配置文件，json, js, 或者ts。
        if (this.#config === undefined) {
            const { default: cfg } = await import(this.#cfgFile as string);
            this.#config = cfg;
        }
        if (this.#config == undefined) throw new InvalidData;

        // 获取loader模块路径
        const loader = this.#config.loader ?? "./boot/loader.ts";
        const { default: createLoader } = await import(loader);
        this.#loader = createLoader(config) as Edge;
        // 启动root，并移交控制权。
        return this.#loader.invoke("initialize");
    }

    /** 命令处理。主要是启动停止相关。其中deepedge约定俗成的initialize与start命令等效。 */
    async invoke(command: string, args?: string | BootConfig): Promise<unknown> {
        switch (command) {
            case "initialize":
            case "start":
                return this.start(args);
            case "stop": {
                if (!this.#loader) throw new Unavailable("system is not started");
                const loader = this.#loader;
                this.#loader = undefined;
                return loader.invoke("stop");
            }
            case "restart":
                if (this.#loader) await this.#loader.invoke("stop");
                return this.start(args);
        }
        throw new Unknown(`unknown coomand: ${command}`);
    }

    /** 代理访问内部的配置 */
    get(key?: string): unknown {
        if (key == undefined) return this.#config;
        if (this.#config) return this.#config[key];
        return undefined;
    }

    /** 代理设置内部的配置项 */
    set(value: unknown, key?: string): unknown {
        let res;
        if (key === undefined) {
            res = this.#config;
            this.#config = value as BootConfig;
        } else {
            this.#config ??= {};
            res = this.#config[key];
            this.#config[key] = value;
        }
        return res;
    }
}
