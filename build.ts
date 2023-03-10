import { bundle } from "https://deno.land/x/emit@0.16.0/mod.ts";
import { minify } from "https://deno.land/x/minifier@v1.1.1/mod.ts";

const source = "./src/app.ts";
const target = "./static/app.js";

let code = (await bundle(source)).code;

if (Deno.args[0] === "prod") {
  code = minify("js", code);
}

await Deno.writeTextFile(target, code);
