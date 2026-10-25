// Stripe zero-decimal currencies: amounts are already whole units (no cents).
// Same list as con-backend registration/currency.py.
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
// ISK and UGX are not in the list: Stripe takes them as two-decimal amounts
// (5 ISK = 500), whole units only -- the backend rounds them.

/** Minor-unit digits of a currency: 0 for zero-decimal currencies, else 2. */
export const currencyDecimals = (currency: string = 'USD'): number =>
  ZERO_DECIMAL_CURRENCIES.has((currency || 'USD').toUpperCase()) ? 0 : 2;

/** Minor units (cents, or whole units for JPY/KRW/...) -> major amount. */
export const amountFromCents = (cents: number, currency: string = 'USD'): number =>
  cents / 10 ** currencyDecimals(currency);

/** Major amount typed by an admin -> minor units for the API. */
export const centsFromAmount = (amount: number, currency: string = 'USD'): number =>
  Math.round(amount * 10 ** currencyDecimals(currency));

export const formatPrice = (cents: number | null, currency: string = 'USD'): string => {
  const code = (currency || 'USD').toUpperCase();
  const decimals = currencyDecimals(code);
  const amount = cents === null || cents === undefined ? 0 : cents / 10 ** decimals;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(decimals)}`;
  }
};

/** Like formatPrice, but says so when there is no price instead of showing 0. */
export const formatPriceOrUnavailable = (cents: number | null | undefined, currency: string = 'USD'): string =>
  cents === null || cents === undefined ? 'Pricing unavailable' : formatPrice(cents, currency);

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
