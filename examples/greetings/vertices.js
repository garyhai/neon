export default {
    "Bob": {
        "module": "../examples/greetings/mod.ts",
        "name": "Bob",
        "title": "Mr.",
        "greeting": "Hello",
    },
    "alice": {
        "id": "alice",
        "module": "../examples/greetings/mod.ts",
        "name": "Alice",
        "title": "Ms.",
        "greeting": "Hi"    
    },
    "meet": {
        "module": "../examples/greetings/meet.ts",
        "config": ["alice", "Bob"],
        "initialize": true
    },
    "logger": {
        "module": "../logger/mod.ts",
        "initialize": true,
        "handlers": {
            "default": {
                "id": "console",
                "level": "DEBUG",
                "datetime": "yyyy-MM-dd HH:mm:ss.SSS",
                "formatter": "[{datetime}]-{loggerName}-{levelName}: {msg}"
            }
        },
        "loggers": {
            "default": {
                "level": "DEBUG",
                "handlers": ["default"]
            }
        }
    }
}
