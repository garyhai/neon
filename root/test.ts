// Copyright 2021 the Neunit team. All rights reserved. Neunit licence.

import { assertEquals, assertExists, assertThrows, assertThrowsAsync } from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { Edge } from "../deepgraph/mod.ts";
import { Forbidden, NotFound, Unknown } from "../errors/mod.ts";
import { log } from "../logger/mod.ts";
import createRoot from "./mod.ts";

const LOGGER = {
    module: "../logger/mod.ts",
    initialize: true,
    handlers: {
        default: {
            id: "console",
            level: "DEBUG",
            datetime: "yyyy-MM-dd HH:mm:ss.SSS",
            formatter: "[{datetime}]-{loggerName}-{levelName}: {msg}"
        }
    },
    loggers: {
        default: {
            level: "DEBUG",
            handlers: ["default"],
        }
    }
};

const BOB = {
    module: "../examples/greetings/mod.ts",
    name: "Bob",
    title: "Mr.",
    greeting: "Hello",
};

const ALICE = {
    id: "alice",
    module: "../examples/greetings/mod.ts",
    name: "Alice",
    title: "Ms.",
    greeting: "Hi",
};

const VERTICES = {
    logger: LOGGER,
    Bob: BOB,
    alice: ALICE,
};

const GREETINGS = {
    name: "HelloWorld",
    register: true,
    vertices: VERTICES,
};

const ROOT_CONFIG = {
    token: "secret2+@#%",
    loader: "./loader.ts",
    loaderConfig: GREETINGS,
    preloads: ["logger"],
};

Deno.test("neunit root", async () => {
    const root = createRoot(ROOT_CONFIG);
    assertEquals(root.get("logger"), undefined);
    log.info("root is created without initialization");
    assertExists(await root.invoke("initialize"));
    log.info("root is initialized");

    const logger = root.get("logger") as Edge;
    assertEquals(logger.get(["loggers", "default", "level"]), "DEBUG");

    assertEquals(root.get("Bob"), undefined);
    const bob = await root.invoke("load", "Bob") as Edge;
    assertEquals(root.get("Bob"), bob);
    assertEquals(bob.get("name"), "Bob");
    assertThrows(() => bob.get("gender"), NotFound);
    assertThrowsAsync(async () => {
        await bob.invoke("noop");
    }, Unknown);

    assertEquals(root.get("alice"), undefined);
    const response = await bob.invoke("meet", "alice");
    assertEquals(response, "welcome");
    assertExists(root.get("alice"));

    assertThrowsAsync(async () => {
        await root.invoke("deregister", "Bob");
    }, Forbidden);
    const token = ROOT_CONFIG.token;
    assertEquals(await root.invoke("deregister", "Bob", {token}), true);
    assertEquals(root.get("Bob"), undefined);
    const newBob = await root.invoke("load", "Bob") as Edge;
    assertEquals(newBob === bob, false);
    assertEquals(newBob, bob);
});