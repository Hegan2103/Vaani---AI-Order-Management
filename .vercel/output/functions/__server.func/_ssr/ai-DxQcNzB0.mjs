import { r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-HWUekL9b.mjs";
import { i as createSsrRpc } from "./login-screen-Ddp81uGG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ai-DxQcNzB0.js
var parseVoiceOrder = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("9fb45d9282a026962d36dbf0e7433bfe7e7c10d28f1ca9e65a75a7c3fe1a3d9b"));
var composeOrderCopy = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(createSsrRpc("00ed397e18128a291a03f51bf39ac47c48c271e9318f5e375dac0072537d2b90"));
//#endregion
export { parseVoiceOrder as n, composeOrderCopy as t };
