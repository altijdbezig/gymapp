import {
  MACRO_SUM_MAX,
  NAME_MAX_LENGTH,
  parseMacroPer100g,
  parseOptionalServing,
  parseProductName,
  validateMacroSum,
} from '../parseFoodInput';

describe('parseProductName', () => {
  it('accepts a normal name', () => {
    expect(parseProductName('Magere kwark')).toEqual({ value: 'Magere kwark' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseProductName('  Skyr  ')).toEqual({ value: 'Skyr' });
  });

  it('asks for a name when empty', () => {
    expect(parseProductName('   ').error).toBe('Vul een naam in.');
  });

  it('refuses a name the column cannot hold', () => {
    expect(parseProductName('x'.repeat(NAME_MAX_LENGTH + 1)).error).toContain(
      String(NAME_MAX_LENGTH),
    );
  });

  it('accepts exactly the maximum length', () => {
    expect(parseProductName('x'.repeat(NAME_MAX_LENGTH)).value).toHaveLength(NAME_MAX_LENGTH);
  });
});

describe('parseMacroPer100g', () => {
  it('reads a whole number', () => {
    expect(parseMacroPer100g('10', 'eiwit', 100)).toEqual({ value: 10 });
  });

  it('reads a Dutch comma decimal', () => {
    expect(parseMacroPer100g('0,2', 'vet', 100)).toEqual({ value: 0.2 });
  });

  it('reads a dot decimal', () => {
    expect(parseMacroPer100g('3.6', 'koolhydraten', 100)).toEqual({ value: 3.6 });
  });

  it('accepts zero', () => {
    expect(parseMacroPer100g('0', 'vet', 100)).toEqual({ value: 0 });
  });

  it('rounds to the two decimals the column stores', () => {
    expect(parseMacroPer100g('10,456', 'eiwit', 100)).toEqual({ value: 10.46 });
  });

  it('names the field when it is empty', () => {
    expect(parseMacroPer100g('', 'eiwit', 100).error).toBe('Vul de eiwit per 100 g in.');
  });

  it.each(['10 gram', 'tien', '1,2,3', '-5', '1e5'])('refuses %p', (input) => {
    expect(parseMacroPer100g(input, 'eiwit', 100).error).toBeDefined();
  });

  it('refuses a macro above 100 g per 100 g', () => {
    expect(parseMacroPer100g('101', 'eiwit', 100).error).toContain('tussen 0 en 100');
  });

  it('allows calories up to their own higher limit', () => {
    expect(parseMacroPer100g('900', 'calorieën', 1000)).toEqual({ value: 900 });
    expect(parseMacroPer100g('1001', 'calorieën', 1000).error).toContain('tussen 0 en 1000');
  });

  it('names the field in every error, so the user knows where to look', () => {
    for (const input of ['', 'onzin', '999']) {
      expect(parseMacroPer100g(input, 'koolhydraten', 100).error).toContain('koolhydraten');
    }
  });
});

describe('parseOptionalServing', () => {
  it('is fine with an empty field', () => {
    expect(parseOptionalServing('')).toEqual({ value: undefined });
    expect(parseOptionalServing('   ')).toEqual({ value: undefined });
  });

  it('reads a serving size', () => {
    expect(parseOptionalServing('150')).toEqual({ value: 150 });
  });

  it('refuses zero and negatives', () => {
    expect(parseOptionalServing('0').error).toBeDefined();
    expect(parseOptionalServing('-10').error).toBeDefined();
  });

  it('refuses a serving the column cannot hold', () => {
    expect(parseOptionalServing('2001').error).toBeDefined();
    expect(parseOptionalServing('2000')).toEqual({ value: 2000 });
  });

  it('refuses text', () => {
    expect(parseOptionalServing('een portie').error).toBeDefined();
  });
});

describe('validateMacroSum', () => {
  it('accepts a normal product', () => {
    expect(validateMacroSum(10, 0.2, 3.6)).toBeUndefined();
  });

  it('accepts exactly 100 g of macros', () => {
    expect(validateMacroSum(0, 100, 0)).toBeUndefined();
    expect(validateMacroSum(33.3, 33.3, 33.4)).toBeUndefined();
  });

  it('refuses more than 100 g of macros, which the database would reject too', () => {
    expect(validateMacroSum(50, 40, 30)).toContain('120');
  });

  it('writes the total with a Dutch comma', () => {
    expect(validateMacroSum(50, 40, 30.5)).toContain('120,5');
  });

  it('does not trip over floating point noise at exactly the limit', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in binary floating point.
    expect(validateMacroSum(99.7, 0.1, 0.2)).toBeUndefined();
  });

  it('agrees with the constraint constant', () => {
    expect(validateMacroSum(MACRO_SUM_MAX, 0, 0)).toBeUndefined();
    expect(validateMacroSum(MACRO_SUM_MAX, 0.01, 0)).toBeDefined();
  });
});
