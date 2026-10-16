const { parseMessage, varintField, messageField } = require("./decode.cjs");

// Sent when the auction house opens in sell mode, read from a capture of 2026-09-29:
//   1: auction house settings (tax, max level, max listings…)
//   2: one entry per listing
//      1: { 1: object uid, 2: item id, 3: lot size (1, 10, 100…) }
//      2: lot price in kamas
// Sent when an item's prices are looked up in buy mode (client asks with "kde"):
//   1: item id
//   2: one entry, absent when the client stops watching that item
//      2: item id, 3: item type, 6: cheapest price of each lot size, packed varints, 0 when none
//   3: item type
const MARKET_CODES = {
  sellerListings: "ket",
  itemPrices: "jzn",
};

// Auction house lots, in the order of the packed prices.
const LOT_SIZES = [1, 10, 100, 1000];

function packedVarints(buf) {
  const values = [];
  let value = 0n;
  let shift = 0n;
  for (const byte of buf) {
    value |= BigInt(byte & 0x7f) << shift;
    if (byte & 0x80) {
      shift += 7n;
      if (shift > 63n) return [];
      continue;
    }
    values.push(Number(value));
    value = 0n;
    shift = 0n;
  }
  return shift === 0n ? values : [];
}

// Prices of the lots of 1, 10 and 100 for one item, cheapest per unit.
function marketPrices(payload) {
  const prices = [];
  for (const entry of payload.get(2) ?? []) {
    if (entry.wireType !== 2) continue;
    const listing = parseMessage(entry.raw);
    const itemId = Number(varintField(listing, 2) ?? 0);
    const lots = listing?.get(6)?.[0];
    if (itemId <= 0 || !lots || lots.wireType !== 2) continue;
    const units = packedVarints(lots.raw)
      .slice(0, LOT_SIZES.length)
      .map((price, index) => (price > 0 ? price / LOT_SIZES[index] : Infinity));
    const unit = Math.min(...units);
    if (Number.isFinite(unit)) prices.push({ itemId, unitPrice: Math.max(1, Math.round(unit)) });
  }
  return prices;
}

// One unit price per item: the cheapest per unit among the player's own lots.
function sellerPrices(payload) {
  const lots = new Map();
  for (const entry of payload.get(2) ?? []) {
    if (entry.wireType !== 2) continue;
    const listing = parseMessage(entry.raw);
    const object = messageField(listing, 1);
    const itemId = Number(varintField(object, 2) ?? 0);
    const quantity = Number(varintField(object, 3) ?? 0);
    const price = Number(varintField(listing, 2) ?? 0);
    if (itemId <= 0 || quantity <= 0 || price <= 0) continue;
    const unit = price / quantity;
    const best = lots.get(itemId);
    if (!best || unit < best) lots.set(itemId, unit);
  }
  return [...lots].map(([itemId, unit]) => ({ itemId, unitPrice: Math.max(1, Math.round(unit)) }));
}

function asUnit(entry) {
  if (!entry || entry.wireType !== 0) return null;
  const value = Number(entry.value);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Prix moyen of one unit, sent as a list of { gid, average } or as one gid plus its average
// (the optional third field is the seller's lot grid and is not the unit price).
// The average is already for a single unit: it is never divided by a quantity.
function averageUnitPrices(payload) {
  const keys = [...payload.keys()];
  if (keys.length === 1 && keys[0] === 1) {
    const entries = payload.get(1) ?? [];
    if (entries.length < 2) return null;
    const prices = [];
    for (const entry of entries) {
      if (entry.wireType !== 2) return null;
      const row = parseMessage(entry.raw);
      const rowKeys = row ? [...row.keys()] : [];
      if (!row || rowKeys.length !== 2 || !row.has(1) || !row.has(2)) return null;
      const itemId = asUnit(row.get(1)[0]);
      const unitPrice = asUnit(row.get(2)[0]);
      if (itemId === null || unitPrice === null) return null;
      prices.push({ itemId, unitPrice });
    }
    return prices;
  }
  if (!keys.includes(1) || !keys.includes(2) || keys.some((key) => key > 3)) return null;
  const extra = payload.get(3)?.[0];
  if (!extra || extra.wireType !== 2) return null;
  const itemId = asUnit(payload.get(1)?.[0]);
  const unitPrice = asUnit(payload.get(2)?.[0]);
  if (itemId === null || unitPrice === null) return null;
  return [{ itemId, unitPrice }];
}

function readMarket(message) {
  const payload = parseMessage(message.value);
  if (!payload) return null;
  if (message.type === MARKET_CODES.sellerListings) return { source: "sale", prices: sellerPrices(payload) };
  if (message.type === MARKET_CODES.itemPrices) return { source: "search", prices: marketPrices(payload) };
  const prices = averageUnitPrices(payload);
  return prices ? { source: "average", prices } : null;
}

module.exports = { MARKET_CODES, readMarket, sellerPrices, marketPrices, averageUnitPrices };
