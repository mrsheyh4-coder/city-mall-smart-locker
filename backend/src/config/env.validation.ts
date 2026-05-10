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

  return validated;
}
