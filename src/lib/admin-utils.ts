export const formatPrice = (cents: number | null, currency: string = 'USD'): string => {
  if (cents === null || cents === undefined) return '$0.00';
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(dollars);
};

export const centsFromDollars = (dollars: number): number => {
  return Math.round(dollars * 100);
};

export const formatDate = (dateString: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const toDateTimeLocalValue = (dateString: string | null): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const parseModules = (modules: unknown): string[] => {
  if (!modules) return [];

  if (Array.isArray(modules)) {
    return modules
      .map((module) => {
        if (typeof module === 'string' || typeof module === 'number') return String(module);
        if (module && typeof module === 'object') {
          const moduleRecord = module as Record<string, unknown>;
          return String(moduleRecord.id || moduleRecord.name || moduleRecord.module || '');
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof modules !== 'string') return [];

  try {
    const parsed = JSON.parse(modules);
    return parseModules(parsed);
  } catch {
    return modules
      .split(',')
      .map((module) => module.trim())
      .filter(Boolean);
  }
};

export const buildPayload = (payload: unknown): string => {
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return '-';
  }
};
