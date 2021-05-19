// Copyright 2021 the Neunit team. All rights reserved. MIT licence.

import { Edge } from "../../deepgraph/mod.ts";
import { log } from "../../logger/mod.ts";

export default function(meet: [string, string], root: Edge): Edge {
    return new Meet(meet, root);
}

class Meet implements Edge {
    #root: Edge;
    #person1: string;
    #person2: string;

    constructor(config: [string, string], root: Edge) {
        this.#root = root;
        [this.#person1, this.#person2] = config;
    }

    get() {}
    set() {}
    async invoke(intent: string): Promise<void> {
        log.warning(`Received command: ${intent}`);
        const person1 = await this.#root.invoke("load", this.#person1) as Edge;
        const response = await person1.invoke("meet", this.#person2);
        log.warning(`Got response from ${this.#person2}: ${response}`);
    }
}