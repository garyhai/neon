PERMESSION := --allow-read --allow-net --allow-env

test:
	deno test $(PERMESSION)

lint: 
	deno lint

upgrade:
	deno run -A https://deno.land/x/udd/main.ts **/*.ts

greetings:
	deno run $(PERMESSION) main.ts -- ../examples/greetings/config.js

compile:
	deno compile $(PERMESSION) main.ts

.PHONY: test lint upgrade greetings compile