import { runMindTick } from "./mind-tick.js";

const r = await runMindTick();
console.log(JSON.stringify(r, null, 2));
