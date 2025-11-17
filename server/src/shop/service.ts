import { logger } from '../core/logger';
import { shopItems } from '../economy/config';
import { ShopItemDefinition } from '../types';
import { applyBcChange, BcChangeResult } from '../wallet/service';
import { incrementCounter } from '../observability/metrics';
import { trackEvent } from '../observability/telemetry';

export interface ShopPurchaseResult {
  item: ShopItemDefinition;
  bc: BcChangeResult;
}

export function listShopItems(): ShopItemDefinition[] {
  return shopItems.filter((s) => s.available);
}

export function purchaseShopItem(
  userId: string,
  shopItemId: string,
): ShopPurchaseResult {
  const item = shopItems.find((s) => s.id === shopItemId && s.available);
  if (!item) {
    throw new Error('SHOP_ITEM_NOT_FOUND');
  }

  const bcResult = applyBcChange(
    userId,
    -item.priceBC,
    `shop_${shopItemId}`,
  );

  logger.info('Shop purchase', {
    userId,
    shopItemId,
    priceBC: item.priceBC,
  });

  incrementCounter('shop_purchases_total', 1, { itemId: shopItemId });
  trackEvent('ShopPurchase', {
    userId,
    shopItemId,
    priceBC: item.priceBC,
  });

  // Inventory integration will be added later; for now we only handle BC.
  return {
    item,
    bc: bcResult,
  };
}
