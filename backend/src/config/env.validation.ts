interface EnvironmentVariables {
  DATABASE_URL: string;
  FRONTEND_URL?: string;
  HARDWARE_MODE?: string;
  NODE_ENV?: string;
  PORT?: string;
  PAYMENT_MODE?: string;
  ADMIN_PIN?: string;
  ADMIN_SESSION_SECRET?: string;
  ADMIN_SESSION_TTL_SECONDS?: string;
  GOOGLE_SHEETS_MODE?: string;
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  GOOGLE_SHEETS_PAYMENTS_SHEET?: string;
  GOOGLE_SHEETS_TARIFFS_SHEET?: string;
  DEVSMS_BASE_URL?: string;
  SMS_MODE?: string;
  SMS_PROVIDER?: string;
  SMS_AUTH_MESSAGE?: string;
  SMS_ALLOW_LOCAL_SEND?: string;
  DEVSMS_TOKEN?: string;
  DEVSMS_SENDER?: string;
  DEVSMS_TYPE?: string;
  DEVSMS_MESSAGE_TYPE?: string;
  DEVSMS_TEMPLATE_TYPE?: string;
  DEVSMS_SERVICE_NAME?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const databaseUrl = config.DATABASE_URL;

  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    if (process.env.NODE_ENV === 'test') {
      return {
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/locker_system?schema=public',
        NODE_ENV: 'test',
      };
    }

    throw new Error('DATABASE_URL is required');
  }

  const validated: EnvironmentVariables = {
    DATABASE_URL: databaseUrl,
  };

  if (typeof config.FRONTEND_URL === 'string') {
    validated.FRONTEND_URL = config.FRONTEND_URL;
  }

  if (typeof config.HARDWARE_MODE === 'string') {
    validated.HARDWARE_MODE = config.HARDWARE_MODE;
  }

  if (typeof config.NODE_ENV === 'string') {
    validated.NODE_ENV = config.NODE_ENV;
  }

  if (typeof config.PORT === 'string') {
    validated.PORT = config.PORT;
  }

  if (typeof config.PAYMENT_MODE === 'string') {
    validated.PAYMENT_MODE = config.PAYMENT_MODE;
  }

  if (typeof config.ADMIN_PIN === 'string') {
    validated.ADMIN_PIN = config.ADMIN_PIN;
  }

  if (typeof config.ADMIN_SESSION_SECRET === 'string') {
    validated.ADMIN_SESSION_SECRET = config.ADMIN_SESSION_SECRET;
  }

  if (typeof config.ADMIN_SESSION_TTL_SECONDS === 'string') {
    validated.ADMIN_SESSION_TTL_SECONDS = config.ADMIN_SESSION_TTL_SECONDS;
  }

  if (typeof config.GOOGLE_SHEETS_MODE === 'string') {
    validated.GOOGLE_SHEETS_MODE = config.GOOGLE_SHEETS_MODE;
  }

  if (typeof config.GOOGLE_SHEETS_SPREADSHEET_ID === 'string') {
    validated.GOOGLE_SHEETS_SPREADSHEET_ID =
      config.GOOGLE_SHEETS_SPREADSHEET_ID;
  }

  if (typeof config.GOOGLE_SERVICE_ACCOUNT_EMAIL === 'string') {
    validated.GOOGLE_SERVICE_ACCOUNT_EMAIL =
      config.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  }

  if (typeof config.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY === 'string') {
    validated.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      config.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  }

  if (typeof config.GOOGLE_SHEETS_PAYMENTS_SHEET === 'string') {
    validated.GOOGLE_SHEETS_PAYMENTS_SHEET =
      config.GOOGLE_SHEETS_PAYMENTS_SHEET;
  }

  if (typeof config.GOOGLE_SHEETS_TARIFFS_SHEET === 'string') {
    validated.GOOGLE_SHEETS_TARIFFS_SHEET = config.GOOGLE_SHEETS_TARIFFS_SHEET;
  }

  if (typeof config.DEVSMS_BASE_URL === 'string') {
    validated.DEVSMS_BASE_URL = config.DEVSMS_BASE_URL;
  }

  if (typeof config.SMS_MODE === 'string') {
    validated.SMS_MODE = config.SMS_MODE;
  }

  if (typeof config.SMS_PROVIDER === 'string') {
    validated.SMS_PROVIDER = config.SMS_PROVIDER;
  }

  if (typeof config.SMS_AUTH_MESSAGE === 'string') {
    validated.SMS_AUTH_MESSAGE = config.SMS_AUTH_MESSAGE;
  }

  if (typeof config.SMS_ALLOW_LOCAL_SEND === 'string') {
    validated.SMS_ALLOW_LOCAL_SEND = config.SMS_ALLOW_LOCAL_SEND;
  }

  if (typeof config.DEVSMS_TOKEN === 'string') {
    validated.DEVSMS_TOKEN = config.DEVSMS_TOKEN;
  }

  if (typeof config.DEVSMS_SENDER === 'string') {
    validated.DEVSMS_SENDER = config.DEVSMS_SENDER;
  }

  if (typeof config.DEVSMS_TYPE === 'string') {
    validated.DEVSMS_TYPE = config.DEVSMS_TYPE;
  }

  if (typeof config.DEVSMS_MESSAGE_TYPE === 'string') {
    validated.DEVSMS_MESSAGE_TYPE = config.DEVSMS_MESSAGE_TYPE;
  }

  if (typeof config.DEVSMS_TEMPLATE_TYPE === 'string') {
    validated.DEVSMS_TEMPLATE_TYPE = config.DEVSMS_TEMPLATE_TYPE;
  }

  if (typeof config.DEVSMS_SERVICE_NAME === 'string') {
    validated.DEVSMS_SERVICE_NAME = config.DEVSMS_SERVICE_NAME;
  }

  if (
    validated.NODE_ENV === 'production' &&
    validated.SMS_MODE === 'DEVSMS' &&
    (!validated.DEVSMS_TOKEN || validated.DEVSMS_TOKEN.trim().length === 0)
  ) {
    throw new Error('DEVSMS_TOKEN is required when SMS_MODE=DEVSMS in production');
  }

  if (validated.NODE_ENV === 'production') {
    if (!validated.ADMIN_PIN || validated.ADMIN_PIN.trim().length === 0) {
      throw new Error('ADMIN_PIN is required in production');
    }

    if (
      !validated.ADMIN_SESSION_SECRET ||
      validated.ADMIN_SESSION_SECRET.length < 32 ||
      validated.ADMIN_SESSION_SECRET === 'change-this-long-random-secret-before-production'
    ) {
      throw new Error(
        'ADMIN_SESSION_SECRET with at least 32 characters is required in production',
      );
    }
  }

  return validated;
}
