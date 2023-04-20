import { dev, prod } from "./params.ts";
import { serve } from "./server.ts";
if (dev || prod) import("./build.ts");

serve();
