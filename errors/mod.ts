// Copyright 2021 the Neunit team. All rights reserved. MIT license.

// deno-lint-ignore-file no-explicit-any

/** Re-export Deno.errors and http errors as neunit errors */

import { createError, IError, Props, Status } from "./deps.ts";

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
  Busy,
} = Deno.errors;

export { Status as Code } from "./deps.ts";

export class Http extends Error {
  #inner: IError;
  constructor(status: any, message?: any, props?: Props) {
    super();
    if (status instanceof Error) {
      this.#inner = createError(status, message);
    } else if (typeof status !== "number") {
      this.#inner = createError(Status.InternalServerError, status, message);
    } else if (message instanceof Error) {
      (message as any).status = status;
      this.#inner = createError(message, props);
    } else {
      this.#inner = createError(status, message, props);
    }
  }

  get name(): string {
    return this.#inner.name;
  }
  get message(): string {
    return this.#inner.message;
  }
  get stack(): string | undefined {
    return this.#inner.stack;
  }
  get status(): number {
    return this.#inner.status;
  }
  get statusCode(): number {
    return this.#inner.statusCode;
  }
  get expose(): boolean {
    return !(this.#inner.expose === false);
  }

  set expose(flag: boolean) {
    this.#inner.expose = flag;
  }

  get(key: string): any {
    return this.#inner[key];
  }

  toString() {
    if (this.expose) {
      return JSON.stringify(this.#inner);
    }
    return `${this.name} [${this.status}]: ${this.message}`;
  }

  toResponse(expose?: boolean): Response {
    expose ??= this.expose;
    if (!expose) {
      const { status, statusText } = this.#inner;
      return new Response(null, { status, statusText });
    }
    let { status, statusText, headers, body, ...others } = this.#inner;
    headers = new Headers(headers);
    if (!headers.has("Content-Type")) {
      headers.append("Content-Type", "application/json; charset=utf-8");
      body = JSON.stringify(body ?? others);
    }
    return new Response(body, { status, statusText, headers });
  }
}

export class Invalid extends InvalidData {
  constructor(msg?: string) {
    super(msg);
    this.name = "Invalid";
  }
}

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

export class Unimplemented extends NotFound {
  constructor(msg?: string) {
    super(msg);
    this.name = "Unimplemented";
  }
}

export class Forbidden extends PermissionDenied {
  constructor(msg?: string) {
    super(msg);
    this.name = "Forbidden";
  }
}
