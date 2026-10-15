import { common } from "./common";
import { orders } from "./orders";
import { menu } from "./menu";
import { ops } from "./ops";
import { stock } from "./stock";
import { recipes } from "./recipes";
import { setup } from "./setup";
import { settings } from "./settings";

/*
 * English → Persian for the admin panel, split by area so each file
 * stays readable. The same English string means the same thing
 * everywhere, so it is translated once; later files win on a clash.
 */
export const FA: Record<string, string> = {
  ...common,
  ...orders,
  ...menu,
  ...ops,
  ...stock,
  ...recipes,
  ...setup,
  ...settings,
};
