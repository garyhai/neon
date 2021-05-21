// Copyright 2021 the Neunit team. All rights reserved. MIT license.

import boot from "./root/boot.ts";
import { log } from "./logger/mod.ts";

/** 主函数模板 */
async function main(): Promise<unknown> {
  const bt = boot();
  return await bt.invoke("start");
}

main().catch((e) => log.error(e));
