import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().positive().required(),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().positive().required(),
  ACTIVATION_TOKEN_TTL_HOURS: Joi.number().integer().positive().required(),
});
