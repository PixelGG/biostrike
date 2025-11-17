import { logger } from '../core/logger';

export interface TelemetryEvent {
  name: string;
  at: number;
  properties?: Record<string, unknown>;
}

const MAX_BUFFERED_EVENTS = 1000;
const events: TelemetryEvent[] = [];

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  const ev: TelemetryEvent = {
    name,
    at: Date.now(),
    properties,
  };

  events.push(ev);
  if (events.length > MAX_BUFFERED_EVENTS) {
    events.splice(0, events.length - MAX_BUFFERED_EVENTS);
  }

  logger.info('telemetry_event', { name, properties });
}

export function getRecentEvents(limit = 100): TelemetryEvent[] {
  if (events.length <= limit) {
    return [...events];
  }
  return events.slice(events.length - limit);
}

