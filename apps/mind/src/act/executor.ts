/** @deprecated World mutations live in world/runtime.ts (Pino mind/world split). */
export {
  applyAct,
  validateAct,
  finalizeAct,
  executeGrantedPermission,
  type WorldActResult,
  type WorldValidation,
} from "../world/runtime.js";
