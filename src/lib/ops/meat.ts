import "server-only";
import { prisma } from "@/lib/prisma";
import { OpsError } from "./documents";

type Actor = { id: string; email: string };

/** The kinds of meat in use, in their set order (for the invoice screen and the ingredient page). */
export function listMeatKinds(include?: string | null) {
  return prisma.meatType.findMany({
    where: { OR: [{ isActive: true }, { id: include ?? "" }] },
    select: { id: true, name: true, nameFa: true, countPieces: true },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
}

/** Which kind of meat an ingredient is (raw meat), or none. Audited. */
export async function setIngredientMeatType(ingredientId: string, meatTypeId: string | null, actor: Actor) {
  const before = await prisma.ingredient.findUnique({ where: { id: ingredientId }, select: { meatTypeId: true } });
  if (!before) throw new OpsError("Ingredient not found.", 404);
  if (before.meatTypeId === meatTypeId) return;
  if (meatTypeId && !(await prisma.meatType.count({ where: { id: meatTypeId } }))) throw new OpsError("That kind of meat no longer exists.");
  await prisma.ingredient.update({ where: { id: ingredientId }, data: { meatTypeId } });
  await prisma.auditLog.create({
    data: { actor: actor.email, action: "ingredient.meat_type", entity: "Ingredient", entityId: ingredientId, before: { meatTypeId: before.meatTypeId }, after: { meatTypeId } },
  });
}
