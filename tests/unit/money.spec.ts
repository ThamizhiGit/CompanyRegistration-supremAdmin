import { expect, test } from '@playwright/test';
import {
  amountInputFromCents,
  centsFromAmount,
  centsFromDollars,
  currencyInputStep,
  moneyInputError,
  wholeNumberError,
} from '../../src/lib/admin-utils';

// Money conversion used by every price / discount / refund form (review #193, #194).
test.describe('money helpers', () => {
  test('centsFromAmount rounds half up without float error', () => {
    // 1.005 * 100 is 100.49999... in floating point: it used to give 100.
    expect(centsFromAmount(1.005, 'USD')).toBe(101);
    expect(centsFromAmount('1.005', 'USD')).toBe(101);
    expect(centsFromAmount('10.50', 'USD')).toBe(1050);
    expect(centsFromAmount('0.29', 'USD')).toBe(29);
    expect(centsFromAmount('1000', 'JPY')).toBe(1000);
    expect(centsFromAmount('10.5', 'JPY')).toBe(11);
    // ISK is a two-decimal currency at Stripe (5 ISK = 500).
    expect(centsFromAmount('5', 'ISK')).toBe(500);
    expect(centsFromAmount('', 'USD')).toBe(0);
    expect(centsFromAmount('abc', 'USD')).toBeNaN();
    expect(centsFromDollars('1.005')).toBe(101);
  });

  test('amounts round-trip through the input text', () => {
    expect(amountInputFromCents(1050, 'USD')).toBe('10.5');
    expect(amountInputFromCents(1000, 'JPY')).toBe('1000');
    expect(amountInputFromCents(null, 'USD')).toBe('');
    expect(centsFromAmount(amountInputFromCents(1999, 'USD'), 'USD')).toBe(1999);
  });

  test('whole-unit currencies take whole amounts only; others at most 2 decimals', () => {
    expect(currencyInputStep('USD')).toBe(0.01);
    expect(currencyInputStep('JPY')).toBe(1);
    expect(currencyInputStep('ISK')).toBe(1);
    expect(currencyInputStep('UGX')).toBe(1);
    expect(moneyInputError('10.5', 'JPY', 'Price')).toBe('Price must be a whole number of JPY (no decimals).');
    expect(moneyInputError('10.5', 'ISK', 'Price')).toBe('Price must be a whole number of ISK (no decimals).');
    expect(moneyInputError('10', 'ISK', 'Price')).toBeNull();
    expect(moneyInputError('10.555', 'USD', 'Price')).toBe('Price can have at most 2 decimals.');
    expect(moneyInputError('10.55', 'USD', 'Price')).toBeNull();
    expect(moneyInputError('-1', 'USD', 'Price')).toBe('Price cannot be negative.');
    expect(moneyInputError('x', 'USD', 'Price')).toBe('Price must be a number.');
    expect(moneyInputError('', 'USD', 'Price')).toBeNull();
  });

  test('whole numbers for Int fields (percentages, limits, months)', () => {
    expect(wholeNumberError('12.5', 'Discount (%)', 0, 100)).toBe('Discount (%) must be a whole number between 0 and 100.');
    expect(wholeNumberError(101, 'Discount (%)', 0, 100)).not.toBeNull();
    expect(wholeNumberError('15', 'Discount (%)', 0, 100)).toBeNull();
    expect(wholeNumberError('2.5', 'Round to', 0)).toBe('Round to must be a whole number (0 or more).');
    expect(wholeNumberError('', 'Employee limit', 0)).toBeNull();
  });
});
