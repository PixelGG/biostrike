export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  env: NodeEnv;
  port: number;
  mongoUri: string;
  jwtSecret: string;
  corsOrigin: string;
}

function readEnv(): AppConfig {
  const env = (process.env.NODE_ENV as NodeEnv) || 'development';

  const portRaw = process.env.PORT ?? '3000';
  const port = Number.parseInt(portRaw, 10) || 3000;

  const mongoUri =
    process.env.MONGO_URI ?? 'mongodb://localhost:27017/biostrike';

  const jwtSecret =
    process.env.JWT_SECRET ??
    'dev-secret-change-me-for-production-only-used-for-prototype';

  const corsOrigin =
    process.env.CORS_ORIGIN ?? 'http://localhost:5173';

  return {
    env,
    port,
    mongoUri,
    jwtSecret,
    corsOrigin,
  };
}

export const config: AppConfig = readEnv();

