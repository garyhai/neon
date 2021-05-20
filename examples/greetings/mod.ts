// Copyright 2021 the Neunit team. All rights reserved. MIT licence.

import { Edge } from "../../deepgraph/mod.ts";
import { Invalid, NotFound, Unknown } from "../../errors/mod.ts";
import { log } from "../../logger/mod.ts";
import { Settings } from "../../root/mod.ts";

/** 默认导出的构建函数。*/
export default function (config: SomeoneConfig, root: Edge): Edge {
    return new Someone(config, root);
}

export interface SomeoneConfig {
    id?: string;
    name: string;
    title: string;
    greeting?: string;
}

export class Someone implements Edge {
    #root: Edge;
    #id: string;
    #greeting: string;
    #name: string;
    #title: string;

    constructor(config: SomeoneConfig, root: Edge) {
        this.#greeting = config.greeting ?? "hello";
        this.#name = config.name;
        this.#title = config.title;
        this.#root = root;
        this.#id = config.id ?? config.name;
    }

    get(key: string): string {
        switch (key) {
            case "id": return this.#id;
            case "name": return this.#name;
            case "greeting": return this.#greeting;
            case "title": return this.#title;
        }
        throw new NotFound;
    }

    set(value: string | SomeoneConfig, key?: string): void {
        switch (key) {
            case "greeting":
                this.#greeting = value as string;
                break;
            case "name":
                this.#name = value as string;
                break;
            case "title":
                this.#title = value as string;
                break;
            case undefined: {
                const { greeting, name, title } = value as SomeoneConfig;
                this.#greeting = greeting!;
                this.#name = name;
                this.#title = title;
            }
        }
        throw new Invalid(`invalid key [${key}]`);
    }

    async invoke(intent: string, payload: string, options?: Settings): Promise<unknown> {
        switch (intent) {
            case "greetings": {
                const { first, from } = options ?? {};
                log.info(`greetings from ${from}: ${payload}`);
                if (first) {
                    return this.sayHello(from as string, false);
                }
                return "welcome";
            }
            case "meet": {
                log.info(`meet ${payload}`);
                return await this.sayHello(payload, true);
            }
        }
        throw new Unknown(`unknown intent: ${intent}`);
    }

    async sayHello(id: string, first: boolean): Promise<unknown> {
        const options = { from: this.#id, first };
        const someone = await this.#root.invoke("load", id) as Edge;
        const title = someone.get("title") as string;
        const name = someone.get("name") as string;
        const greetings = `${this.#greeting}, ${title} ${name}!`;
        return someone.invoke("greetings", greetings, options);
    }
}

