export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMeta {
  [key: string]: unknown;
}

function formatMeta(meta?: LogMeta): string {
  if (!meta || Object.keys(meta).length === 0) {
    return '';
  }
  return ` ${JSON.stringify(meta)}`;
}

export function log(level: LogLevel, message: string, meta?: LogMeta): void {
  const ts = new Date().toISOString();
  // For now, log to stdout; can later be replaced by structured logging backends.
  // eslint-disable-next-line no-console
  console.log(`[${ts}] [${level.toUpperCase()}] ${message}${formatMeta(meta)}`);
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => log('debug', message, meta),
  info: (message: string, meta?: LogMeta) => log('info', message, meta),
  warn: (message: string, meta?: LogMeta) => log('warn', message, meta),
  error: (message: string, meta?: LogMeta) => log('error', message, meta),
};

