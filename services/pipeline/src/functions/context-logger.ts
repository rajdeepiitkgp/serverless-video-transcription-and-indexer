import { type InvocationContext } from '@azure/functions';

import { type Logger, type LogProperties } from '../ports/logger.js';

/**
 * Logger port over the invocation context. Properties are serialized into the
 * message line; the Functions host attaches invocation/operation ids so App
 * Insights correlation (plan §6) still stitches per-video timelines together.
 */
export function contextLogger(context: InvocationContext): Logger {
  const line = (message: string, properties?: LogProperties): string =>
    properties === undefined ? message : `${message} ${JSON.stringify(properties)}`;

  return {
    info: (message, properties) => {
      context.info(line(message, properties));
    },
    warn: (message, properties) => {
      context.warn(line(message, properties));
    },
    error: (message, properties) => {
      context.error(line(message, properties));
    },
  };
}
