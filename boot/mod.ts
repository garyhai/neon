// Copyright 2021 the Neunit team. All rights reserved. Neunit licence.

import { Edge } from "../deepgraph/mod.ts";
import { AlreadyExists, BadResource, Unavailable, Unknown } from "../errors/mod.ts";

/** 默认导出的构建函数。与其他模块不同的是，Boot模块没有根域。 */
export default function startup(args?: string | BootConfig): Edge {
    return new Boot(args);
}

export interface BootConfig {
    starter?: string;
    config?: string | Record<string, unknown>;
}

/** Boot 也是一个deepedge，只是没有根域。 */
export class Boot implements Edge {
    // 系统实例
    #starter?: Edge;
    // 内部配置
    #bootConfig: BootConfig = {};

    /** 构造时要传入解析好的配置。*/
    constructor(config?: string | BootConfig) {
        if (typeof config === "string") {
            this.#bootConfig.config = config;
        } else if (config) {
            this.#bootConfig = config;
        }
        // 传入配置参数优先级最高，其次是命令行参数中的配置文件路径，最后是环境变量。
        this.#bootConfig.config ??= Deno.args[1] ?? Deno.env.get("NEUNIT_CONFIG_FILE") ?? "neunit.json";
        this.#bootConfig.starter ??= Deno.args[2] ?? Deno.env.get("NEUNIT_STARTER") ?? "./boot/root.ts";
    }

    /** 如果config参数不为空，则会覆盖原有配置项。这个设计是为了未来能够在运行时动态启动。*/
    async start(config?: string | BootConfig): Promise<unknown> {
        if (this.#starter) throw new AlreadyExists("Already started");
        let bc = this.#bootConfig;
        if (typeof config === "string") {
            bc.config = config;
        } else if (config) {
            bc = config;
        }

        // 加载配置文件，json, js, 或者ts。
        if (typeof bc.config === "string") {
            bc.config = await loadDefault(bc.config);
        }

        // 获取loader模块路径
        const starter = bc.starter ?? "./boot/root.ts";
        const createStarter = await loadDefault(starter);
        this.#starter = createStarter(config) as Edge;
        // 启动starter，并移交控制权。
        return this.#starter.invoke("initialize");
    }

    /** 命令处理。主要是启动停止相关。其中deepedge约定俗成的initialize与start命令等效。 */
    async invoke(command: string, args?: string | BootConfig): Promise<unknown> {
        switch (command) {
            case "initialize":
            case "start":
                return this.start(args);
            case "stop": {
                if (!this.#starter) throw new Unavailable("system is not started");
                const starter = this.#starter;
                this.#starter = undefined;
                return starter.invoke("stop");
            }
            case "restart":
                if (this.#starter) await this.#starter.invoke("stop");
                return this.start(args);
        }
        throw new Unknown(`unknown coomand: ${command}`);
    }
}

// deno-lint-ignore no-explicit-any
export async function loadDefault(modPath: string): Promise<any> {
    const { default: module } = await import(modPath);
    if (module === undefined) throw new BadResource("no default export");
    return module;
}