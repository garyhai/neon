// Copyright 2021 the Neunit team. All rights reserved. MIT license.

import {
  assertEquals,
  assertObjectMatch,
  assertThrows,
} from "https://deno.land/std@0.100.0/testing/asserts.ts";
import { Busy, Code, Http, NotFound } from "./mod.ts";

Deno.test("neon errors", async () => {
  const notFound = new NotFound("not found");
  assertThrows(
    () => {
      throw notFound;
    },
    NotFound,
    "not found",
  );

  const httpNotFound = new Http(Code.NotFound, { direction: "east" });
  assertThrows(
    () => {
      throw httpNotFound;
    },
    Http,
    "Not Found",
  );
  assertEquals(httpNotFound.status, 404);
  let resp = httpNotFound.toResponse();
  let body = await resp.json();
  assertEquals(body.message, "Not Found");
  assertEquals(body.direction, "east");

  const busy = new Busy();
  const serverBusy = new Http(busy, { timeout: 10, message: "waiting" });
  assertEquals(serverBusy.toString(), "Busy [500]: waiting");
  assertEquals(serverBusy.status, 500);
  assertEquals(serverBusy.expose, false);
  assertEquals(serverBusy.get("timeout"), 10);
  resp = serverBusy.toResponse();
  assertEquals(resp.body, null);
  serverBusy.expose = true;
  const body1 = JSON.parse(serverBusy.toString());
  assertEquals(body1.timeout, 10);
  resp = serverBusy.toResponse();
  body = await resp.json();
  assertEquals(body.timeout, 10);
  assertObjectMatch(body1, body);
  assertThrows(
    () => {
      throw serverBusy;
    },
    Http,
    "waiting",
  );

  const clientBusy = new Http(Code.RequestTimeout, busy, {
    timeout: 10,
    message: "waiting",
  });
  assertEquals(clientBusy.status, 408);
  assertEquals(clientBusy.expose, true);
  resp = clientBusy.toResponse();
  body = await resp.json();
  assertEquals(body.timeout, 10);
  assertThrows(
    () => {
      throw clientBusy;
    },
    Http,
    "waiting",
  );

  const errInfo = new Http({
    timeout: 10,
    message: "timeout",
  });
  assertEquals(errInfo.status, 500);
  assertEquals(errInfo.expose, false);
  assertEquals(errInfo.get("timeout"), 10);
  resp = errInfo.toResponse();
  assertEquals(resp.body, null);
  assertEquals(resp.status, 500);
  assertThrows(
    () => {
      throw errInfo;
    },
    Http,
    "timeout",
  );
});
