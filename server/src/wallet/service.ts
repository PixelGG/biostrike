import { logger } from '../core/logger';
import {
  CurrencyTransaction,
  CurrencyWallet,
} from '../types';

const wallets = new Map<string, CurrencyWallet>();
const transactions: CurrencyTransaction[] = [];

export function getWallet(userId: string): CurrencyWallet {
  const existing = wallets.get(userId);
  if (existing) return existing;

  const wallet: CurrencyWallet = {
    userId,
    biocredits: 0,
  };
  wallets.set(userId, wallet);
  return wallet;
}

export interface BcChangeResult {
  before: CurrencyWallet;
  after: CurrencyWallet;
}

export function applyBcChange(
  userId: string,
  delta: number,
  reason: string,
): BcChangeResult {
  const wallet = getWallet(userId);
  const before: CurrencyWallet = { ...wallet };

  wallet.biocredits = Math.max(0, wallet.biocredits + delta);
  wallets.set(userId, wallet);

  const tx: CurrencyTransaction = {
    userId,
    delta,
    reason,
    at: Date.now(),
  };
  transactions.push(tx);

  logger.info('BC transaction', {
    userId,
    delta,
    biocreditsAfter: wallet.biocredits,
    reason,
  });

  return {
    before,
    after: { ...wallet },
  };
}

