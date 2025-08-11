import dotenv from 'dotenv';
import Joi from 'joi';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  GITHUB_CLIENT_ID: Joi.string().required(),
  GITHUB_CLIENT_SECRET: Joi.string().required(),
  GITHUB_WEBHOOK_SECRET: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  ENABLE_REDIS: Joi.string().valid('true', 'false').default('false'),
  JWT_SECRET: Joi.string().required(),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  github: {
    clientId: envVars.GITHUB_CLIENT_ID,
    clientSecret: envVars.GITHUB_CLIENT_SECRET,
    webhookSecret: envVars.GITHUB_WEBHOOK_SECRET,
  },
  redis: {
    url: envVars.REDIS_URL,
    enabled: envVars.ENABLE_REDIS === 'true',
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    expiresIn: '7d',
  },
  logging: {
    level: envVars.LOG_LEVEL,
  },
} as const;