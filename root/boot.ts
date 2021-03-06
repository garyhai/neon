// Copyright 2021 the Neunit team. All rights reserved. MIT licence.

import { Edge } from "../deepgraph/mod.ts";
import {
  AlreadyExists,
  Forbidden,
  Unavailable,
  Unknown,
} from "../errors/mod.ts";
import { load, loadConfig, Settings } from "./mod.ts";

/** 默认导出的构建函数。与其他模块不同的是，Boot模块没有根域。 */
export default function startup(args?: string | BootConfig): Edge {
  return new Boot(args);
}

export interface BootConfig {
  starter?: string;
  config?: string | Settings;
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
    this.#bootConfig.config ??= Deno.args[1] ??
      Deno.env.get("NEON_CONFIG_FILE") ?? "neon.json";
    this.#bootConfig.starter ??= Deno.args[2] ??
      Deno.env.get("NEON_STARTER") ?? "./mod.ts";
  }

  /** 如果config参数不为空，则会覆盖原有配置项。这个设计是为了未来能够在运行时动态启动。*/
  async start(): Promise<unknown> {
    if (this.#starter) throw new AlreadyExists("Already started");
    let starterConfig;
    if (typeof this.#bootConfig.config === "string") {
      // 加载配置文件，json, js, 或者ts。
      starterConfig = await loadConfig(this.#bootConfig.config);
    } else {
      // 制作一个副本避免被意外更改。
      starterConfig = { ...this.#bootConfig.config };
    }
    // 获取loader模块路径
    const createStarter = await load(this.#bootConfig.starter!);
    this.#starter = createStarter(starterConfig) as Edge;
    // 启动starter，并移交控制权。
    return this.#starter.invoke("initialize");
  }

  /** 命令处理。主要是启动停止相关。其中deepedge约定俗成的initialize与start命令等效。 */
  async invoke(command: string): Promise<unknown> {
    switch (command) {
      case "initialize":
      case "start":
        return this.start();
      case "stop": {
        if (!this.#starter) throw new Unavailable("system is not started");
        const starter = this.#starter;
        this.#starter = undefined;
        return starter.invoke("quit");
      }
      case "restart":
        if (this.#starter) await this.#starter.invoke("stop");
        return this.start();
    }
    throw new Unknown(`unknown coomand: ${command}`);
  }

  get(key: string): Edge | undefined {
    if (key === "starter" || key === "root") return this.#starter;
    return undefined;
  }

  set() {
    throw new Forbidden();
  }
}
