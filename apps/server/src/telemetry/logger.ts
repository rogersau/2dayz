export type Logger = {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
};

const writeLog = (write: typeof console.info, message: string, context?: Record<string, unknown>): void => {
  write(new Date().toISOString(), message, context ?? {});
};

export const createLogger = (): Logger => {
  return {
    info(message, context) {
      writeLog(console.info, message, context);
    },
    error(message, context) {
      writeLog(console.error, message, context);
    },
  };
};
