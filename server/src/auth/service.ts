import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { logger } from '../core/logger';
import { SessionRecord, UserAccount, UserRole, UserStatus } from '../types';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const accountsById = new Map<string, UserAccount>();
const accountsByUsername = new Map<string, UserAccount>();
const sessions = new Map<string, SessionRecord>();
const refreshTokens = new Map<string, { sessionId: string; userId: string; expiresAt: number }>();

// Simple in-memory ID generator.
let userCounter = 0;
let sessionCounter = 0;

function createUserId(): string {
  userCounter += 1;
  return `u_${userCounter.toString(36)}_${Date.now().toString(36)}`;
}

function createSessionId(): string {
  sessionCounter += 1;
  return `s_${sessionCounter.toString(36)}_${Date.now().toString(36)}`;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
  session: SessionRecord;
}

export interface AccessTokenClaims {
  sub: string; // userId
  sid: string; // sessionId
  role: UserRole;
  exp: number;
}

export async function registerUser(
  username: string,
  password: string,
): Promise<UserAccount> {
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 32) {
    throw new Error('USERNAME_INVALID');
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error('PASSWORD_INVALID');
  }
  if (accountsByUsername.has(trimmed.toLowerCase())) {
    throw new Error('USERNAME_TAKEN');
  }

  const id = createUserId();
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = Date.now();

  const account: UserAccount = {
    id,
    username: trimmed,
    passwordHash,
    role: 'user',
    status: 'active',
    failedLoginAttempts: 0,
    createdAt: now,
  };

  accountsById.set(id, account);
  accountsByUsername.set(trimmed.toLowerCase(), account);

  logger.info('User registered', { userId: id, username: trimmed });

  return account;
}

export interface LoginResult extends TokenPair {
  user: UserAccount;
}

export async function loginUser(
  username: string,
  password: string,
  ip?: string,
  userAgent?: string,
): Promise<LoginResult> {
  const account = accountsByUsername.get(username.trim().toLowerCase());

  // Avoid username enumeration; generic failure.
  if (!account) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    throw new Error('INVALID_CREDENTIALS');
  }

  if (account.status === 'banned') {
    throw new Error('ACCOUNT_BANNED');
  }
  if (account.status === 'locked' && account.lockedUntil && account.lockedUntil > Date.now()) {
    throw new Error('ACCOUNT_LOCKED');
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    account.failedLoginAttempts += 1;
    if (account.failedLoginAttempts >= 5) {
      account.status = 'locked';
      account.lockedUntil = Date.now() + 10 * 60 * 1000; // 10 minutes lock
      logger.warn('Account locked due to failed logins', { userId: account.id });
    }
    throw new Error('INVALID_CREDENTIALS');
  }

  account.failedLoginAttempts = 0;
  account.status = 'active';
  account.lockedUntil = undefined;
  account.lastLoginAt = Date.now();
  account.lastIp = ip;
  account.lastUserAgent = userAgent;

  const sessionId = createSessionId();
  const session: SessionRecord = {
    id: sessionId,
    userId: account.id,
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
    ip,
    userAgent,
  };
  sessions.set(sessionId, session);

  const tokens = issueTokens(account, session);

  return {
    user: account,
    ...tokens,
  };
}

function issueTokens(user: UserAccount, session: SessionRecord): TokenPair {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessExp = nowSeconds + Math.floor(ACCESS_TOKEN_TTL_MS / 1000);
  const refreshExpMs = Date.now() + REFRESH_TOKEN_TTL_MS;

  const claims: AccessTokenClaims = {
    sub: user.id,
    sid: session.id,
    role: user.role,
    exp: accessExp,
  };

  const accessToken = jwt.sign(claims, config.jwtSecret);

  const refreshTokenId = `rt_${Math.random().toString(36).slice(2, 12)}`;
  const refreshToken = refreshTokenId;
  refreshTokens.set(refreshTokenId, {
    sessionId: session.id,
    userId: user.id,
    expiresAt: refreshExpMs,
  });

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: accessExp * 1000,
    refreshTokenExpiresAt: refreshExpMs,
    session,
  };
}

export function validateAccessToken(token: string): AccessTokenClaims | null {
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AccessTokenClaims;
    return decoded;
  } catch {
    return null;
  }
}

export function refreshTokenPair(
  refreshToken: string,
  ip?: string,
  userAgent?: string,
): TokenPair {
  const record = refreshTokens.get(refreshToken);
  if (!record) {
    throw new Error('REFRESH_INVALID');
  }
  if (record.expiresAt <= Date.now()) {
    refreshTokens.delete(refreshToken);
    throw new Error('REFRESH_EXPIRED');
  }

  const session = sessions.get(record.sessionId);
  const account = accountsById.get(record.userId);
  if (!session || !account) {
    refreshTokens.delete(refreshToken);
    throw new Error('SESSION_INVALID');
  }

  session.lastSeenAt = Date.now();
  session.ip = ip ?? session.ip;
  session.userAgent = userAgent ?? session.userAgent;

  // Rotate refresh token.
  refreshTokens.delete(refreshToken);

  return issueTokens(account, session);
}

export function getAccountById(userId: string): UserAccount | undefined {
  return accountsById.get(userId);
}

export function getAccountByUsername(username: string): UserAccount | undefined {
  return accountsByUsername.get(username.trim().toLowerCase());
}

