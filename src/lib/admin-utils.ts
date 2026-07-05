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

export const parseModules = (modulesJson: string | null): string[] => {
  if (!modulesJson) return [];
  try {
    return JSON.parse(modulesJson);
  } catch {
    return [];
  }
};
