import { logger } from '../core/logger';
import {
  MarketListing,
  MarketListingStatus,
  MarketTransaction,
  MatchMode,
  Region,
} from '../types';
import { economyConfig } from '../economy/config';
import { applyBcChange, getWallet } from '../wallet/service';
import { incrementCounter } from '../observability/metrics';
import { trackEvent } from '../observability/telemetry';

const listings = new Map<string, MarketListing>();
const transactions: MarketTransaction[] = [];

let listingCounter = 0;
let transactionCounter = 0;

function createListingId(): string {
  listingCounter += 1;
  return `lst_${listingCounter.toString(36)}_${Date.now().toString(36)}`;
}

function createTransactionId(): string {
  transactionCounter += 1;
  return `mktx_${transactionCounter.toString(36)}_${Date.now().toString(36)}`;
}

export interface CreateListingInput {
  itemType: 'floran' | 'item';
  refId: string;
  priceBC: number;
  region: Region;
}

export function createListing(
  sellerId: string,
  data: CreateListingInput,
): MarketListing {
  if (data.priceBC <= 0) {
    throw new Error('MARKET_PRICE_INVALID');
  }

  const now = Date.now();
  const durationMs = economyConfig.defaultListingDurationHours * 60 * 60 * 1000;

  const id = createListingId();

  const listing: MarketListing = {
    id,
    sellerId,
    itemType: data.itemType,
    refId: data.refId,
    priceBC: data.priceBC,
    region: data.region,
    createdAt: now,
    expiresAt: now + durationMs,
    status: 'active',
    feeBC: 0,
  };

  const listingFee = Math.round(data.priceBC * economyConfig.marketListingFeeRate);
  if (listingFee > 0) {
    applyBcChange(sellerId, -listingFee, `market_listing_fee_${id}`);
    listing.feeBC += listingFee;
  }

  listings.set(id, listing);

  logger.info('Market listing created', {
    id,
    sellerId,
    priceBC: listing.priceBC,
    feeBC: listing.feeBC,
  });

  incrementCounter('market_listings_created_total', 1, { region: data.region });
  trackEvent('MarketListingCreated', {
    listingId: id,
    sellerId,
    priceBC: listing.priceBC,
    region: data.region,
    itemType: data.itemType,
  });

  return listing;
}

export function getActiveListings(): MarketListing[] {
  const now = Date.now();
  const result: MarketListing[] = [];
  for (const listing of listings.values()) {
    if (listing.status !== 'active') continue;
    if (listing.expiresAt <= now) {
      listing.status = 'expired';
      logger.info('Market listing expired', { id: listing.id });
      continue;
    }
    result.push(listing);
  }
  return result;
}

export function cancelListing(
  userId: string,
  listingId: string,
): MarketListing {
  const listing = listings.get(listingId);
  if (!listing) {
    throw new Error('MARKET_LISTING_NOT_FOUND');
  }
  if (listing.sellerId !== userId) {
    throw new Error('MARKET_NOT_SELLER');
  }
  if (listing.status !== 'active') {
    throw new Error('MARKET_NOT_ACTIVE');
  }

  listing.status = 'canceled';
  logger.info('Market listing canceled', { id: listing.id, userId });

  return listing;
}

export interface BuyListingResult {
  listing: MarketListing;
  transaction: MarketTransaction;
}

export function buyListing(
  buyerId: string,
  listingId: string,
): BuyListingResult {
  const listing = listings.get(listingId);
  if (!listing) {
    throw new Error('MARKET_LISTING_NOT_FOUND');
  }
  if (listing.status !== 'active') {
    throw new Error('MARKET_NOT_ACTIVE');
  }
  const now = Date.now();
  if (listing.expiresAt <= now) {
    listing.status = 'expired';
    logger.info('Market listing expired on buy', { id: listing.id });
    throw new Error('MARKET_EXPIRED');
  }

  const buyerWallet = getWallet(buyerId);
  if (buyerWallet.biocredits < listing.priceBC) {
    throw new Error('MARKET_INSUFFICIENT_FUNDS');
  }

  const fee = Math.round(listing.priceBC * economyConfig.marketTransactionFeeRate);
  const net = listing.priceBC - fee;

  applyBcChange(buyerId, -listing.priceBC, `market_buy_${listing.id}`);
  applyBcChange(listing.sellerId, net, `market_sell_${listing.id}`);

  listing.status = 'sold';

  const txId = createTransactionId();
  const tx: MarketTransaction = {
    id: txId,
    listingId: listing.id,
    buyerId,
    sellerId: listing.sellerId,
    priceBC: listing.priceBC,
    feeBC: fee,
    netBC: net,
    at: now,
  };
  transactions.push(tx);

  logger.info('Market listing sold', {
    listingId: listing.id,
    buyerId,
    sellerId: listing.sellerId,
    priceBC: listing.priceBC,
    feeBC: fee,
  });

  incrementCounter('market_transactions_total', 1, { region: listing.region });
  trackEvent('MarketListingSold', {
    transactionId: txId,
    listingId: listing.id,
    buyerId,
    sellerId: listing.sellerId,
    priceBC: listing.priceBC,
    feeBC: fee,
    netBC: net,
    region: listing.region,
  });

  // Inventory transfer will be implemented later.

  return {
    listing,
    transaction: tx,
  };
}
