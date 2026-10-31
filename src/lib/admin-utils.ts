// Stripe zero-decimal currencies: amounts are already whole units (no cents).
// Same list as con-backend registration/currency.py.
export const ZERO_DECIMAL_CURRENCIES = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
// ISK and UGX are not in the list: Stripe takes them as two-decimal amounts
// (5 ISK = 500), whole units only -- the backend rounds them.
export const WHOLE_UNIT_CURRENCIES = new Set(['ISK', 'UGX']);

/** Smallest amount an admin can type: 1 for JPY and for ISK/UGX (whole units), else 0.01. */
export const currencyInputStep = (currency: string = 'USD'): number => {
  const code = (currency || 'USD').toUpperCase();
  return WHOLE_UNIT_CURRENCIES.has(code) ? 1 : 1 / 10 ** currencyDecimals(code);
};

/** Minor-unit digits of a currency: 0 for zero-decimal currencies, else 2. */
export const currencyDecimals = (currency: string = 'USD'): number =>
  ZERO_DECIMAL_CURRENCIES.has((currency || 'USD').toUpperCase()) ? 0 : 2;

/** Minor units (cents, or whole units for JPY/KRW/...) -> major amount. */
export const amountFromCents = (cents: number, currency: string = 'USD'): number =>
  cents / 10 ** currencyDecimals(currency);

/** Minor units -> the text an amount input shows (1050 USD -> "10.5", 1000 JPY -> "1000"). */
export const amountInputFromCents = (cents: number | null | undefined, currency: string = 'USD'): string =>
  cents === null || cents === undefined ? '' : String(amountFromCents(cents, currency));

/** `amount` x 10^digits, rounded half away from zero, without float error (1.005 -> 100.5 -> 101). */
const shiftAndRound = (amount: number | string, digits: number): number => {
  const text = typeof amount === 'number' ? String(amount) : amount.trim();
  if (!text) return 0;
  const value = Number(text);
  if (!Number.isFinite(value)) return NaN;
  // Move the decimal point in the text: 1.005 * 100 is 100.49999... in floating point.
  const shifted = /e/i.test(text) ? value * 10 ** digits : Number(`${text}e${digits}`);
  return Math.sign(shifted) * Math.round(Math.abs(shifted));
};

/** Major amount typed by an admin (a number or the input's text) -> minor units for the API. */
export const centsFromAmount = (amount: number | string, currency: string = 'USD'): number =>
  shiftAndRound(amount, currencyDecimals(currency));

/** True for currencies an admin may only type whole amounts in (JPY, KRW, ... and ISK/UGX). */
export const isWholeUnitCurrency = (currency: string = 'USD'): boolean => {
  const code = (currency || 'USD').toUpperCase();
  return currencyDecimals(code) === 0 || WHOLE_UNIT_CURRENCIES.has(code);
};

/**
 * Why a typed money amount can't be saved in `currency`, or null when it can
 * (blank is allowed -- the caller decides whether a value is required).
 * Whole-unit currencies refuse decimals instead of silently rounding them.
 */
export const moneyInputError = (input: string, currency: string = 'USD', label = 'Amount'): string | null => {
  const text = (input || '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return `${label} must be a number.`;
  if (value < 0) return `${label} cannot be negative.`;
  const code = (currency || 'USD').toUpperCase();
  if (isWholeUnitCurrency(code) && !Number.isInteger(value)) return `${label} must be a whole number of ${code} (no decimals).`;
  const minor = value * 10 ** currencyDecimals(code);
  if (Math.abs(minor - Math.round(minor)) > 1e-6) return `${label} can have at most ${currencyDecimals(code)} decimals.`;
  return null;
};

/** Why a typed value is not a whole number in [min, max], or null when it is (blank allowed). */
export const wholeNumberError = (input: string | number, label: string, min = 0, max?: number): string | null => {
  const text = String(input ?? '').trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    return max === undefined
      ? `${label} must be a whole number${min > 0 ? ` of at least ${min}` : min === 0 ? ' (0 or more)' : ''}.`
      : `${label} must be a whole number between ${min} and ${max}.`;
  }
  return null;
};

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

/** Hundredths of an amount (expenses keep every currency in hundredths), without float error. */
export const centsFromDollars = (dollars: number | string): number => shiftAndRound(dollars, 2);

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
