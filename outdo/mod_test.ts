// Copyright 2021 the Neunit team. All rights reserved. Neunit license.

import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { makeFullPath } from "./mod.ts";

Deno.test("outdo partial functions", () => {
  const fullPath = "/a/b/c.x";
  assertEquals(fullPath, makeFullPath(fullPath));

  const cfg = {
    name: "test",
    ext: ".so",
    dir: "/a/b/c",
  };
  let expected = "/a/b/c/libtest.so";
  assertEquals(makeFullPath(cfg), expected);

  const newCfg = { ...cfg, ...{ base: "basetest.dll" } };
  expected = "/a/b/c/basetest.dll";
  assertEquals(makeFullPath(newCfg), expected);
});
