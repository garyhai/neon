test:
	deno test

lint: 
	deno lint

upgrade:
	deno run -A https://deno.land/x/udd/main.ts **/*.ts

.PHONY: test lint