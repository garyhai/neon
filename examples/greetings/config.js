export default {
    "token": "secret2+@#%",
    "loader": "./loader.ts",
    "loaderConfig": {
        "name": "HelloWorld",
        "register": true,
        "vertices": "../examples/greetings/vertices.js"
    },
    "preloads": ["logger", "meet"]
}