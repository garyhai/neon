// Copyright 2021 the Neunit team. All rights reserved. MIT license.

/** Re-export Deno.errors and http errors as neunit errors
 * 
 * Deno.errors.Http is replaced by http-errors from [@curveball/http-errors](https://github.com/curveball/http-errors).
 */

import { HttpProblem, InternalServerError, isHttpProblem, BadRequest } from "./deps.ts";
export * as Http from "./deps.ts";
export const {
    NotFound,
    PermissionDenied,
    ConnectionRefused,
    ConnectionReset,
    ConnectionAborted,
    NotConnected,
    AddrInUse,
    AddrNotAvailable,
    BrokenPipe,
    AlreadyExists,
    InvalidData,
    TimedOut,
    Interrupted,
    WriteZero,
    UnexpectedEof,
    BadResource,
    Busy
} = Deno.errors;

export class Unknown extends InvalidData {
    constructor(msg?: string) {
        super(msg);
        this.name = "Unknown";
      }  
}

export class Unavailable extends NotFound {
    constructor(msg?: string) {
        super(msg);
        this.name = "Unavailable";
      }  
}

/** Convert common error to HTTP server error or HTTP client error */
export function toHttpError<E extends Error>(err: E, isClient = false): HttpProblem {
    if (isHttpProblem(err)) return err;
    const detail = err.message || err.name;
    const e500 = isClient ? new BadRequest(detail) : new InternalServerError(detail);
    Object.assign(e500, err);
    return e500;
}
