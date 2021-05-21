// deno-lint-ignore-file no-explicit-any

import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";
import { loadConfig } from "./mod.ts";

const DATA = {
  "token": "secret2+@#%",
  "loader": "./loader.ts",
  "loaderConfig": {
    "name": "HelloWorld",
    "register": true,
    "vertices": "../examples/greetings/vertices.js",
  },
  "preloads": ["logger", "meet"],
};

const JSON_DATA = JSON.stringify(DATA);

const JS_DATA = "export default " + JSON_DATA;

Deno.test("root: loadConfig", async () => {
  const jsonFile = await Deno.makeTempFile({ suffix: ".json" });
  assertEquals(jsonFile.endsWith(".json"), true);
  await Deno.writeTextFile(jsonFile, JSON_DATA);
  const jsonData: any = await loadConfig(jsonFile);
  assertEquals(jsonData.loader, "./loader.ts");
  assertEquals(jsonData, DATA);

  const jsFile = await Deno.makeTempFile({ suffix: ".js" });
  assertEquals(jsFile.endsWith(".js"), true);
  await Deno.writeTextFile(jsFile, JS_DATA);
  const jsData: any = await loadConfig(jsFile);
  assertEquals(jsData.loader, "./loader.ts");
  assertEquals(jsData, DATA);

  await Deno.remove(jsonFile);
  await Deno.remove(jsFile);
});
