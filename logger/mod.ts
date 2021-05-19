// Copyright 2021 the Neunit team. All rights reserved. MIT license.

// TODO: Add more commands: add handlers, add loggers, change settings.

import { setup, LevelName, LoggerConfig, getLogger, LogConfig, handlers as LogHandlers, info, warning, error, critical, debug, Logger } from "https://deno.land/std@0.97.0/log/mod.ts";
import { LogRecord } from "https://deno.land/std@0.97.0/log/logger.ts";
import { format } from "https://deno.land/std@0.97.0/datetime/mod.ts";
import { Edge, Vertex, toVertex, toArray } from "../deepgraph/mod.ts";

export const log = { info, warning, error, critical, debug };
export { LoggerConfig, Logger };
export type { LevelName };

/** 默认导出的构建函数。*/
export default function(config?: LoggersConfig): Edge {
    return new LoggersManager(config);
}

const { FileHandler, RotatingFileHandler, ConsoleHandler } = LogHandlers;

type FormatterFunction = (logRecord: LogRecord) => string;
interface BaseHandlerConfig {
    id?: string;
    level?: LevelName;
    datetime?: string;
    formatter?: string | FormatterFunction;
}

export interface FileConfig extends BaseHandlerConfig {
    filename: string;
    mode?: "a" | "w" | "x";
}

export interface RotatingFileConfig extends FileConfig {
    maxBytes: number;
    maxBackupCount: number;
}

export type HandlerConfig = BaseHandlerConfig | FileConfig | RotatingFileConfig;

export interface LoggersConfig {
    handlers?: { [index: string]: HandlerConfig };
    loggers: { [index: string]: LoggerConfig };
}

const DEFAULT_CONSOLE_HANDLER: HandlerConfig = {
    id: "console",
    level: "INFO"
};

const DEFAULT_LOGGER: LoggerConfig = {
    level: "INFO",
    handlers: ["default"],
};

const DEFAULT_CONFIG: LoggersConfig = {
    handlers: { default: DEFAULT_CONSOLE_HANDLER },
    loggers: { default: DEFAULT_LOGGER },
};

export class LoggersManager implements Edge {
    #config: Vertex;

    constructor(config: LoggersConfig = DEFAULT_CONFIG) {
        this.#config = toVertex(config);
    }

    get(path?: string | string[]): unknown {
        if (Array.isArray(path)) return this.#config.get(path);
        return getLogger(path);
    }

    set(config: unknown, path?: string | string[]): unknown {
        if (typeof path === "string") {
            path = ["loggers", path];
        }
        return this.#config.set(config, path);
    }

    async invoke(intent: string | string[], data?: unknown): Promise<unknown> {
        const [cmd, ...path] = toArray(intent);
        switch (cmd) {
            case "initialize":
            case "setup":
                return await this.initialize(data as LoggersConfig);
            case "logger": return getLogger(path[0]);
            case "getConfig": return this.get(path);
            case "config":
                this.set(data, path);
                return await this.initialize();
            case "remove":
                this.set(undefined, path);
                return await this.initialize();
        }
        throw new Error(`unknown intent: ${intent}`);
    }

    async initialize(config?: LoggersConfig) {
        let newConfig = this.#config.get() as LoggersConfig;
        if (config != undefined) {
            newConfig = { ...newConfig, ...config };
        }

        const logConfig = {
            loggers: newConfig.loggers,
            handlers: makeHandlers(newConfig.handlers)
        };
        await setup(logConfig as LogConfig);
    }
}

function makeHandlers(handlers?: { [index: string]: HandlerConfig }): unknown {
    if (handlers == undefined) return undefined;
    const res: { [name: string]: unknown } = {};
    for (const [k, v] of Object.entries(handlers)) {
        if (typeof v.formatter === "string") {
            v.formatter = makeFormatter(v.formatter, v.datetime);
        }
        const level = v.level ?? "INFO";
        switch (v.id) {
            case "file":
            case "FILE":
                res[k] = new FileHandler(level, v as FileConfig);
                break;
            case "rotating":
            case "ROTATING":
                res[k] = new RotatingFileHandler(level, v as RotatingFileConfig);
                break;
            default:
                res[k] = new ConsoleHandler(level, v);
                break;
        }
    }
    return res;
}

function makeFormatter(tpl: string, ldml?: string): FormatterFunction {
    return (LogRecord) => formatter(LogRecord, tpl, ldml);
}

function formatter(logRecord: LogRecord, tpl: string, ldml?: string): string {
    return tpl.replace(/{(\w+)}/g, (match, p1): string => {
        const value = logRecord[p1 as keyof LogRecord];
        // do not interpolate missing values
        if (value == null) return match;
        if (value instanceof Date && ldml) return format(value, ldml);
        return String(value);
    });
}
