// Copyright 2021 the Neunit team. All rights reserved. MIT license.

import { assertEquals, assertThrows, assertThrowsAsync } from "https://deno.land/std/testing/asserts.ts";
import { Edge } from "./mod.ts";

interface Options {
    prefix?: string;
    postfix?: string;
}

class Vert implements Edge {
    #inner: string;
    constructor(inner: string) {
        this.#inner = inner;
    }

    get(index: number): string {
        return this.#inner.charAt(index);
    }
    set(value: string, index: number): string {
        if (index >= this.#inner.length) throw new Error("out of bound");
        const s = this.#inner;
        this.#inner = s.substring(0, index) + value + s.substring(index + 1);
        return this.#inner;
    }
    // deno-lint-ignore require-await
    async invoke(intent: string, data = "", options: Options = {}): Promise<string | number> {
        let { prefix, postfix } = options;
        prefix ??= "";
        postfix ??= "";
        switch (intent) {
            case "append": return prefix + this.#inner + data + postfix;
            case "length": return this.#inner.length;
            default: throw new Error(`unknown intent: ${intent}`);
        }
    }
}

Deno.test("simple vertex", async () => {
    const vert = new Vert("hello, world!");
    assertEquals(vert.get(0), "h");
    const length = await vert.invoke("length");
    assertEquals(length, "hello, world!".length);
    const newString = vert.set("H", 0);
    assertEquals(newString, "Hello, world!");
    const result = await vert.invoke("append", "!", { prefix: "<<", postfix: ">>" });
    assertEquals(result, "<<Hello, world!!>>");
    assertThrows(() => vert.set("!", 40), Error, "out of bound");
    await assertThrowsAsync(async () => await vert.invoke("invalid"));
});
