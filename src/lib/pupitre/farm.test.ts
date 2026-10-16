import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY_FARM, lineValue, snapshot, type FarmResource } from "./farm.ts";

function resource(qty: string, price: string): FarmResource {
  return {
    id: `${qty}-${price}`,
    name: "Ressource",
    qty,
    price,
    itemId: 1,
    icon: "",
    typeName: "",
    level: null,
  };
}

test("la valeur est la quantité fois le prix d'une unité", () => {
  assert.equal(lineValue("11", "1000"), 11_000);
  assert.equal(lineValue("4", "250"), 1_000);
  assert.equal(lineValue("16", "10"), 160);
  assert.equal(lineValue("", "1000"), 0);

  const totals = snapshot(
    {
      ...EMPTY_FARM,
      kamas: 64,
      resources: [resource("11", "1000"), resource("6", "10")],
    },
    0,
  );
  assert.equal(totals.gross, 64 + 11_000 + 60);
});
