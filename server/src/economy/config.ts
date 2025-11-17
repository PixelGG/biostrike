import { ShopItemDefinition } from '../types';

export interface EconomyConfig {
  marketListingFeeRate: number;
  marketTransactionFeeRate: number;
  defaultListingDurationHours: number;
}

export const economyConfig: EconomyConfig = {
  marketListingFeeRate: 0.01,
  marketTransactionFeeRate: 0.08,
  defaultListingDurationHours: 48,
};

export const shopItems: ShopItemDefinition[] = [
  {
    id: 'shop_mulch',
    itemId: 'mulch',
    displayName: 'Mulch-Sack',
    priceBC: 50,
    category: 'essential',
    available: true,
  },
  {
    id: 'shop_watering_can',
    itemId: 'watering_can',
    displayName: 'Gießkanne',
    priceBC: 40,
    category: 'essential',
    available: true,
  },
  {
    id: 'shop_leaf_wax',
    itemId: 'leaf_wax',
    displayName: 'Blattwachs',
    priceBC: 60,
    category: 'essential',
    available: true,
  },
  {
    id: 'shop_bannkern_1',
    itemId: 'bannkern_1',
    displayName: 'Bannkern I',
    priceBC: 120,
    category: 'banncore',
    available: true,
  },
  {
    id: 'shop_bannkern_2',
    itemId: 'bannkern_2',
    displayName: 'Bannkern II',
    priceBC: 260,
    category: 'banncore',
    available: true,
  },
  {
    id: 'shop_bannkern_3',
    itemId: 'bannkern_3',
    displayName: 'Bannkern III',
    priceBC: 480,
    category: 'banncore',
    available: true,
  },
];

