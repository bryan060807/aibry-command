export interface Logger {
  info(event: string, fields?: Record<string, string | number | boolean>): void;
  warn(event: string, fields?: Record<string, string | number | boolean>): void;
  error(event: string, fields?: Record<string, string | number | boolean>): void;
}

const write = (level: string, event: string, fields: Record<string, string | number | boolean> = {}) => {
  const safeFields = Object.fromEntries(Object.entries(fields).filter(([key]) =>
    ['operation', 'method', 'path', 'status', 'durationMs', 'repository', 'port'].includes(key),
  ));
  process.stdout.write(`${JSON.stringify({ level, event, ...safeFields })}\n`);
};

export const logger: Logger = {
  info: (event, fields) => write('info', event, fields),
  warn: (event, fields) => write('warn', event, fields),
  error: (event, fields) => write('error', event, fields),
};
