const { parseMessage, varintField, messageField } = require("./decode.cjs");

// Sent when the auction house opens in sell mode, read from a capture of 2026-09-29:
//   1: auction house settings (tax, max level, max listings…)
//   2: one entry per listing
//      1: { 1: object uid, 2: item id, 3: lot size (1, 10, 100…) }
//      2: lot price in kamas
const MARKET_CODES = {
  sellerListings: "ket",
};

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

function readMarket(message) {
  if (message.type !== MARKET_CODES.sellerListings) return null;
  const payload = parseMessage(message.value);
  if (!payload) return null;
  return { source: "sale", prices: sellerPrices(payload) };
}

module.exports = { MARKET_CODES, readMarket, sellerPrices };
