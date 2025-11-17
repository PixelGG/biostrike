export type MetricKind = 'counter' | 'gauge';

export interface MetricLabelSet {
  [key: string]: string;
}

interface CounterMetric {
  kind: 'counter';
  name: string;
  help?: string;
  values: Map<string, number>;
}

interface GaugeMetric {
  kind: 'gauge';
  name: string;
  help?: string;
  values: Map<string, number>;
}

type Metric = CounterMetric | GaugeMetric;

const metrics = new Map<string, Metric>();

function labelKey(labels?: MetricLabelSet): string {
  if (!labels) return '';
  const entries = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([k, v]) => `${k}=${v}`).join(',');
}

function getOrCreateCounter(name: string, help?: string): CounterMetric {
  const existing = metrics.get(name);
  if (existing && existing.kind === 'counter') {
    return existing;
  }
  const metric: CounterMetric = {
    kind: 'counter',
    name,
    help,
    values: new Map<string, number>(),
  };
  metrics.set(name, metric);
  return metric;
}

function getOrCreateGauge(name: string, help?: string): GaugeMetric {
  const existing = metrics.get(name);
  if (existing && existing.kind === 'gauge') {
    return existing;
  }
  const metric: GaugeMetric = {
    kind: 'gauge',
    name,
    help,
    values: new Map<string, number>(),
  };
  metrics.set(name, metric);
  return metric;
}

export function incrementCounter(
  name: string,
  value = 1,
  labels?: MetricLabelSet,
  help?: string,
): void {
  const metric = getOrCreateCounter(name, help);
  const key = labelKey(labels);
  const current = metric.values.get(key) ?? 0;
  metric.values.set(key, current + value);
}

export function setGauge(
  name: string,
  value: number,
  labels?: MetricLabelSet,
  help?: string,
): void {
  const metric = getOrCreateGauge(name, help);
  const key = labelKey(labels);
  metric.values.set(key, value);
}

export interface MetricSnapshotEntry {
  name: string;
  kind: MetricKind;
  help?: string;
  values: {
    labels?: MetricLabelSet;
    value: number;
  }[];
}

export function getMetricsSnapshot(): MetricSnapshotEntry[] {
  const snapshot: MetricSnapshotEntry[] = [];
  metrics.forEach((metric) => {
    const values: { labels?: MetricLabelSet; value: number }[] = [];
    metric.values.forEach((val, key) => {
      const labels: MetricLabelSet | undefined =
        key === ''
          ? undefined
          : key.split(',').reduce((acc, pair) => {
              const [k, v] = pair.split('=');
              if (k) acc[k] = v ?? '';
              return acc;
            }, {} as MetricLabelSet);
      values.push({ labels, value: val });
    });
    snapshot.push({
      name: metric.name,
      kind: metric.kind,
      help: metric.help,
      values,
    });
  });
  return snapshot;
}

