import { offProductsToFoodInserts, offProductToFoodInsert } from '../offMapping';
import type { OffProduct } from '@/lib/openFoodFacts';

/** A well-filled Open Food Facts product, the happy path. */
function product(overrides: Partial<OffProduct> = {}): OffProduct {
  return {
    code: '8712100849718',
    product_name: 'Magere kwark',
    brands: 'Albert Heijn',
    serving_quantity: 150,
    nutriments: {
      'energy-kcal_100g': 55,
      proteins_100g: 10,
      fat_100g: 0.2,
      carbohydrates_100g: 3.6,
    },
    ...overrides,
  };
}

describe('offProductToFoodInsert', () => {
  it('maps a complete product', () => {
    const result = offProductToFoodInsert(product());

    expect(result.food).toEqual({
      source: 'off',
      barcode: '8712100849718',
      name: 'Magere kwark',
      brand: 'Albert Heijn',
      kcal_per_100g: 55,
      protein_per_100g: 10,
      fat_per_100g: 0.2,
      carbs_per_100g: 3.6,
      serving_size_g: 150,
      is_public: true,
      created_by: null,
    });
  });

  it('produces exactly the shape the foods_source_shape constraint demands', () => {
    const { food } = offProductToFoodInsert(product());
    expect(food!.source).toBe('off');
    expect(food!.barcode).not.toBeNull();
    expect(food!.is_public).toBe(true);
    expect(food!.created_by).toBeNull();
  });

  describe('names', () => {
    it('prefers the Dutch name', () => {
      const result = offProductToFoodInsert(
        product({ product_name: 'Skyr', product_name_nl: 'Skyr naturel' }),
      );
      expect(result.food?.name).toBe('Skyr naturel');
    });

    it('falls back to the generic name', () => {
      const result = offProductToFoodInsert(product({ product_name_nl: '   ' }));
      expect(result.food?.name).toBe('Magere kwark');
    });

    it('refuses a product with no name at all', () => {
      const result = offProductToFoodInsert(
        product({ product_name: '', product_name_nl: undefined }),
      );
      expect(result.refusal).toBe('Dit product heeft geen naam in Open Food Facts.');
    });

    it('trims a very long name to what the column accepts', () => {
      const result = offProductToFoodInsert(product({ product_name: 'x'.repeat(500) }));
      expect(result.food?.name).toHaveLength(200);
    });
  });

  describe('brands', () => {
    it('takes the first of a comma-separated list', () => {
      const result = offProductToFoodInsert(product({ brands: 'Albert Heijn,AH,AH Basic' }));
      expect(result.food?.brand).toBe('Albert Heijn');
    });

    it('reads the array shape the search endpoint returns', () => {
      // The product endpoint gives "Mars, Mars Wrigley"; the search endpoint
      // gives ["Melkan"]. Calling .split() on the array would throw.
      const result = offProductToFoodInsert(product({ brands: ['Melkan', 'Melkan Basic'] }));
      expect(result.food?.brand).toBe('Melkan');
    });

    it('skips empty entries in the array shape', () => {
      expect(offProductToFoodInsert(product({ brands: ['  ', 'Melkan'] })).food?.brand).toBe(
        'Melkan',
      );
    });

    it('is null when there is no brand', () => {
      expect(offProductToFoodInsert(product({ brands: undefined })).food?.brand).toBeNull();
      expect(offProductToFoodInsert(product({ brands: '  ' })).food?.brand).toBeNull();
      expect(offProductToFoodInsert(product({ brands: [] })).food?.brand).toBeNull();
      expect(offProductToFoodInsert(product({ brands: ['  '] })).food?.brand).toBeNull();
    });

    it('never throws, whatever shape brands arrives in', () => {
      const shapes = ['Melkan', ['Melkan'], [], '', undefined];
      for (const brands of shapes) {
        expect(() => offProductToFoodInsert(product({ brands }))).not.toThrow();
      }
    });

    it('trims a very long brand to what the column accepts', () => {
      const result = offProductToFoodInsert(product({ brands: 'y'.repeat(400) }));
      expect(result.food?.brand).toHaveLength(120);
    });
  });

  describe('numbers that arrive as strings', () => {
    it('reads numeric strings', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: {
            'energy-kcal_100g': '55',
            proteins_100g: '10',
            fat_100g: '0.2',
            carbohydrates_100g: '3.6',
          },
        }),
      );
      expect(result.food?.kcal_per_100g).toBe(55);
      expect(result.food?.protein_per_100g).toBe(10);
    });

    it('reads a comma decimal', () => {
      const result = offProductToFoodInsert(
        product({ nutriments: { ...product().nutriments, fat_100g: '0,2' } }),
      );
      expect(result.food?.fat_per_100g).toBe(0.2);
    });

    it('refuses a value that is not a number', () => {
      const result = offProductToFoodInsert(
        product({ nutriments: { ...product().nutriments, proteins_100g: 'onbekend' } }),
      );
      expect(result.refusal).toBe('Van dit product zijn geen voedingswaarden bekend.');
    });
  });

  describe('energy', () => {
    it('converts kilojoules when kcal is missing', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: {
            'energy-kj_100g': 230,
            proteins_100g: 10,
            fat_100g: 0.2,
            carbohydrates_100g: 3.6,
          },
        }),
      );
      // 230 / 4.184 = 54.97...
      expect(result.food?.kcal_per_100g).toBeCloseTo(54.97, 1);
    });

    it('falls back to the generic energy field', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: {
            energy_100g: 418.4,
            proteins_100g: 10,
            fat_100g: 0.2,
            carbohydrates_100g: 3.6,
          },
        }),
      );
      expect(result.food?.kcal_per_100g).toBe(100);
    });

    it('prefers kcal over kilojoules when both are present', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: { ...product().nutriments, 'energy-kj_100g': 9999 },
        }),
      );
      expect(result.food?.kcal_per_100g).toBe(55);
    });
  });

  describe('refusing data the database would reject', () => {
    it('refuses a product with no nutriments', () => {
      const result = offProductToFoodInsert(product({ nutriments: undefined }));
      expect(result.refusal).toBe('Van dit product zijn geen voedingswaarden bekend.');
    });

    it.each(['proteins_100g', 'fat_100g', 'carbohydrates_100g', 'energy-kcal_100g'])(
      'refuses when %s is missing',
      (field) => {
        const nutriments = { ...product().nutriments };
        delete nutriments[field];
        const result = offProductToFoodInsert(product({ nutriments }));
        expect(result.refusal).toBe('Van dit product zijn geen voedingswaarden bekend.');
      },
    );

    it('refuses macros that add up to more than 100 g per 100 g', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: {
            'energy-kcal_100g': 500,
            proteins_100g: 50,
            fat_100g: 40,
            carbohydrates_100g: 30,
          },
        }),
      );
      expect(result.refusal).toBe('De voedingswaarden van dit product kloppen niet.');
    });

    it('refuses an impossible calorie count', () => {
      const result = offProductToFoodInsert(
        product({ nutriments: { ...product().nutriments, 'energy-kcal_100g': 5000 } }),
      );
      expect(result.refusal).toBe('De voedingswaarden van dit product kloppen niet.');
    });

    it('refuses a negative value', () => {
      const result = offProductToFoodInsert(
        product({ nutriments: { ...product().nutriments, fat_100g: -3 } }),
      );
      expect(result.refusal).toBe('De voedingswaarden van dit product kloppen niet.');
    });

    it('accepts macros that add up to exactly 100', () => {
      const result = offProductToFoodInsert(
        product({
          nutriments: {
            'energy-kcal_100g': 900,
            proteins_100g: 0,
            fat_100g: 100,
            carbohydrates_100g: 0,
          },
        }),
      );
      expect(result.food).toBeDefined();
    });

    it.each(['', '12345', '123456789012345', 'abcdef', '87121-00849718'])(
      'refuses the invalid barcode %p',
      (code) => {
        expect(offProductToFoodInsert(product({ code })).refusal).toBe(
          'Dit product heeft geen geldige barcode.',
        );
      },
    );

    it.each(['123456', '8712100849718', '12345678901234'])('accepts the barcode %p', (code) => {
      expect(offProductToFoodInsert(product({ code })).food).toBeDefined();
    });
  });

  describe('serving size', () => {
    it('keeps a sensible serving', () => {
      expect(offProductToFoodInsert(product({ serving_quantity: 30 })).food?.serving_size_g).toBe(
        30,
      );
    });

    it.each([0, -5, 5000, undefined])('drops the unusable serving %p', (serving) => {
      const result = offProductToFoodInsert(product({ serving_quantity: serving }));
      expect(result.food?.serving_size_g).toBeNull();
    });
  });

  it('rounds to the two decimals the columns store', () => {
    const result = offProductToFoodInsert(
      product({
        nutriments: {
          'energy-kcal_100g': 55.6789,
          proteins_100g: 10.4321,
          fat_100g: 0.2,
          carbohydrates_100g: 3.6,
        },
      }),
    );
    expect(result.food?.kcal_per_100g).toBe(55.68);
    expect(result.food?.protein_per_100g).toBe(10.43);
  });

  it('always returns either a food or a refusal, never both or neither', () => {
    const inputs = [
      product(),
      product({ code: 'nope' }),
      product({ nutriments: undefined }),
      product({ product_name: '' }),
    ];
    for (const input of inputs) {
      const result = offProductToFoodInsert(input);
      expect(Boolean(result.food) !== Boolean(result.refusal)).toBe(true);
    }
  });
});

describe('offProductsToFoodInserts', () => {
  it('keeps the usable products and drops the rest', () => {
    const results = offProductsToFoodInserts([
      product({ code: '1111111111111' }),
      product({ code: 'invalid' }),
      product({ code: '2222222222222', nutriments: undefined }),
      product({ code: '3333333333333' }),
    ]);

    expect(results.map((food) => food.barcode)).toEqual(['1111111111111', '3333333333333']);
  });

  it('drops a repeated barcode, which the unique index would reject', () => {
    const results = offProductsToFoodInserts([
      product({ code: '1111111111111', product_name: 'Eerste' }),
      product({ code: '1111111111111', product_name: 'Tweede' }),
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Eerste');
  });

  it('returns an empty list for an empty search result', () => {
    expect(offProductsToFoodInserts([])).toEqual([]);
  });
});
