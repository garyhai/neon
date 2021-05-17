// Copyright 2021 the Neunit team. All rights reserved. MIT license.

import { assert, assertEquals, assertThrows } from "https://deno.land/std/testing/asserts.ts";
import { Http, NotFound, toHttpError, Busy } from "./mod.ts";

Deno.test("neunit errors", () => {
    const notFound = new NotFound("not found");
    assertThrows(() => {
        throw notFound;
    }, NotFound, "not found");

    const httpNotFound = new Http.NotFound("not found");
    assertThrows(() => {
        throw httpNotFound;
    }, Http.NotFound, "not found");

    assert(Http.isHttpError(httpNotFound));
    assertEquals(Http.isHttpError(notFound), false);
    assertEquals(httpNotFound.httpStatus, 404);

    const busy = new Busy;
    const serverBusy = toHttpError(busy);
    assert(Http.isServerError(serverBusy));
    assertEquals(serverBusy.httpStatus, 500);
    const clientBusy = toHttpError(busy, true);
    assertEquals(clientBusy.httpStatus, 400);
    assert(Http.isClientError(clientBusy));

    assertThrows(() => {
        throw serverBusy;
    }, Http.InternalServerError, "Busy");
    assertThrows(() => {
        throw clientBusy;
    }, Http.BadRequest, "Busy");
});
