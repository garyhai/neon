// Copyright 2021 the Neunit team. All rights reserved. Neunit license.

/** 随时输出最后一个表达式内容，用于快速调试。 */
// deno-lint-ignore no-explicit-any
export function trace(...x: unknown[]): any {
  console.log(...x);
  return x.pop();
}

/** 执行一次HTTP请求后主动关闭连接。 */
export function fetchOnce(
  input: string | Request | URL,
  init?: RequestInit,
): Promise<Response> {
  if (init == null) {
    init = { headers: { "Connection": "close" } };
  } else {
    const { headers } = init;
    const h = new Headers(headers);
    h.set("Connection", "close");
    init.headers = h;
  }
  return fetch(input, init);
}
