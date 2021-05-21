// Copyright 2021 the Neunit team. All rights reserved. MIT license.

import { assertEquals } from "https://deno.land/std@0.97.0/testing/asserts.ts";

import { default as create, log, Logger, LoggersConfig } from "./mod.ts";

const LOG_CONFIG: LoggersConfig = {
  handlers: {
    default: {
      id: "console",
      level: "INFO",
      formatter: "{levelName}: {msg}",
    },
    verbose: {
      id: "console",
      level: "DEBUG",
      datetime: "yyyy-MM-dd HH:mm:ss.SSS",
      formatter: "[{datetime}]-{loggerName}-{levelName}: {msg}",
    },
  },
  loggers: {
    default: {
      level: "INFO",
      handlers: ["default"],
    },
    verbose: {
      level: "DEBUG",
      handlers: ["verbose"],
    },
  },
};

Deno.test("neunit loggers", async () => {
  const logger = create(LOG_CONFIG);
  await logger.invoke("setup");
  assertEquals(log.info("start logging"), "start logging");
  assertEquals(
    log.warning(logger.get(["handlers", "default", "id"])),
    "console",
  );
  assertEquals(log.error("error"), "error");
  assertEquals(log.critical("critical"), "critical");
  assertEquals(log.debug("debug"), "debug");

  const verbose = logger.get("verbose") as Logger;
  assertEquals(verbose.info("verbose mode"), "verbose mode");
  assertEquals(verbose.warning("warning"), "warning");
  assertEquals(verbose.error("error"), "error");
  assertEquals(verbose.critical("critical"), "critical");
  assertEquals(verbose.debug("debug"), "debug");

  assertEquals(logger.get(["loggers", "verbose", "level"]), "DEBUG");
  assertEquals(logger.set("NOTSET", ["loggers", "default", "level"]), "level");
  log.debug("debug message is not logged");
  await logger.invoke(["config", "handlers", "default", "level"], "NOTSET");
  log.debug("debug message is logged");
});
