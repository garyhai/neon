// Copyright 2021 the Neunit team. All rights reserved. Neunit license.

import { assertEquals } from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { fetchOnce, trace } from "./mod.ts";

Deno.test("trace", () => {
  let m = 1;
  const n = 2;
  m = trace("Test m + n:", m, "+", n, "=", m + n) as number;
  assertEquals(m, 3);
});

Deno.test("fetchOnce", async () => {
  const server = Deno.listen({ port: 8050 });
  (async () => {
    for await (const conn of server) {
      (async () => {
        const httpConn = Deno.serveHttp(conn);
        let count = 0;
        for await (const requestEvent of httpConn) {
          const headers = requestEvent.request.headers;
          const resp = new Response("ok", { headers });
          await requestEvent.respondWith(resp);
          count++;
        }
        assertEquals(count, 1);
      })();
    }
  })();
  const userAgent = "toolkit-test";
  const res = await fetchOnce("http://127.0.0.1:8050", {
    headers: { "User-Agent": userAgent },
  });
  assertEquals(res.status, 200);
  assertEquals(await res.text(), "ok");
  const ua = res.headers.get("user-agent");
  assertEquals(ua, "toolkit-test");
  server.close();
});
