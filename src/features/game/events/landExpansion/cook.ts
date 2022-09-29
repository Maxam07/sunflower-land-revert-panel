import cloneDeep from "lodash.clonedeep";
import Decimal from "decimal.js-light";
import { ConsumableName, CONSUMABLES } from "features/game/types/consumables";
import { GameState } from "features/game/types/game";
import { getKeys } from "features/game/types/craftables";
import { trackActivity } from "features/game/types/bumpkinActivity";

export type RecipeCookedAction = {
  type: "recipe.cooked";
  item: ConsumableName;
  buildingId: string;
};

type Options = {
  state: Readonly<GameState>;
  action: RecipeCookedAction;
  createdAt?: number;
};

export function cook({
  state,
  action,
  createdAt = Date.now(),
}: Options): GameState {
  const stateCopy = cloneDeep(state);

  const { building: requiredBuilding, ingredients } = CONSUMABLES[action.item];
  const { buildings, bumpkin } = stateCopy;
  const buildingsOfRequiredType = buildings[requiredBuilding];

  if (!Object.keys(buildings).length || !buildingsOfRequiredType) {
    throw new Error(`Required building does not exist`);
  }

  const building = buildingsOfRequiredType.find(
    (building) => building.id === action.buildingId
  );

  if (bumpkin === undefined) {
    throw new Error("You do not have a Bumpkin");
  }

  if (!building) {
    throw new Error(`Required building does not exist`);
  }

  if (building.crafting !== undefined) {
    throw new Error("Cooking already in progress");
  }

  const stockAmount = stateCopy.stock[action.item] || new Decimal(0);

  if (stockAmount.lessThan(1)) {
    throw new Error("Not enough stock");
  }

  const subtractedInventory = getKeys(ingredients).reduce(
    (inventory, ingredient) => {
      const count = inventory[ingredient] || new Decimal(0);
      const amount = ingredients[ingredient] || new Decimal(0);

      if (count.lessThan(amount)) {
        throw new Error(`Insufficient ingredient: ${ingredient}`);
      }

      return {
        ...inventory,
        [ingredient]: count.sub(amount),
      };
    },
    stateCopy.inventory
  );

  building.crafting = {
    name: action.item,
    readyAt: createdAt + CONSUMABLES[action.item].cookingSeconds * 1000,
  };

  stateCopy.stock[action.item] = stockAmount.minus(new Decimal(1));

  bumpkin.activity = trackActivity(`${action.item} Cooked`, bumpkin.activity);

  return {
    ...stateCopy,
    inventory: subtractedInventory,
    buildings,
  };
}
