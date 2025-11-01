// Testes para ShippingCalculator
// Valida que os cálculos estão corretos após refatoração

import { ShippingCalculator } from '../services/ShippingCalculator';
import { Product } from '../models/Product';
import type { MLProduct } from '@/types/mercadoLivre';

describe('ShippingCalculator', () => {
  let calculator: ShippingCalculator;

  beforeEach(() => {
    calculator = new ShippingCalculator();
  });

  describe('calculate', () => {
    test('deve retornar estatísticas zeradas para array vazio', () => {
      const result = calculator.calculate([]);

      expect(result.total).toBe(0);
      expect(result.flex.count).toBe(0);
      expect(result.full.count).toBe(0);
      expect(result.correios.count).toBe(0);
    });

    test('deve calcular corretamente com produtos ativos', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'FLEX',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        },
        {
          id: '2',
          ml_item_id: 'MLB2',
          title: 'FULL',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['fulfillment']
        },
        {
          id: '3',
          ml_item_id: 'MLB3',
          title: 'Agências',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['xd_drop_off']
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      expect(result.total).toBe(3);
      expect(result.flex.count).toBe(1);
      expect(result.flex.percentage).toBeCloseTo(33.33, 1);
      expect(result.full.count).toBe(1);
      expect(result.agencies.count).toBe(1);
    });

    test('deve ignorar produtos inativos', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'Ativo',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        },
        {
          id: '2',
          ml_item_id: 'MLB2',
          title: 'Pausado',
          status: 'paused',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        },
        {
          id: '3',
          ml_item_id: 'MLB3',
          title: 'Fechado',
          status: 'closed',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      // Apenas 1 produto ativo
      expect(result.total).toBe(1);
      expect(result.flex.count).toBe(1);
    });

    test('deve contar produto em múltiplas categorias', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'Multi-shipping',
          status: 'active',
          shipping_modes: ['me2', 'drop_off'],
          logistic_types: ['self_service', 'fulfillment']
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      // 1 produto total
      expect(result.total).toBe(1);
      
      // Mas conta em múltiplas categorias
      expect(result.flex.count).toBe(1);
      expect(result.full.count).toBe(1);
      expect(result.correios.count).toBe(1);
      
      // Porcentagens podem ultrapassar 100% no total
      const totalPercentage = 
        result.flex.percentage + 
        result.full.percentage + 
        result.correios.percentage;
      expect(totalPercentage).toBeGreaterThanOrEqual(300);
    });
  });

  describe('calculateSimple', () => {
    test('deve retornar formato simplificado', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'FLEX',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculateSimple(products);

      expect(result).toHaveProperty('flex');
      expect(result).toHaveProperty('total');
      expect(result.flex).toBe(1);
      expect(result.total).toBe(1);
      expect(typeof result.flex).toBe('number');
    });
  });

  describe('hasShippingType', () => {
    test('deve verificar tipo de envio corretamente', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '1',
        ml_item_id: 'MLB1',
        title: 'FLEX',
        status: 'active',
        shipping_modes: ['me2'],
        logistic_types: ['self_service']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);

      expect(calculator.hasShippingType(product, 'flex')).toBe(true);
      expect(calculator.hasShippingType(product, 'full')).toBe(false);
      expect(calculator.hasShippingType(product, 'agencies')).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    test('deve funcionar com formato antigo (campos únicos)', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'Produto Antigo',
          status: 'active',
          shipping_mode: 'me2',
          logistic_type: 'self_service'
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      expect(result.flex.count).toBe(1);
      expect(result.total).toBe(1);
    });

    test('deve priorizar arrays sobre campos únicos', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'Produto Mix',
          status: 'active',
          shipping_mode: 'custom', // Será ignorado
          shipping_modes: ['me2'],  // Será usado
          logistic_type: 'cross_docking', // Será ignorado
          logistic_types: ['self_service'] // Será usado
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      // Deve ser FLEX (me2 + self_service), não Coleta
      expect(result.flex.count).toBe(1);
      expect(result.collection.count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('deve lidar com produtos sem modos de envio', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB1',
          title: 'Sem shipping',
          status: 'active'
          // Sem shipping_mode/shipping_modes
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      expect(result.total).toBe(1);
      // Nenhum tipo específico contado
      expect(result.flex.count).toBe(0);
      expect(result.full.count).toBe(0);
    });

    test('deve calcular porcentagens corretamente', () => {
      const rawProducts: Partial<MLProduct>[] = [
        { id: '1', ml_item_id: 'MLB1', title: 'FLEX', status: 'active', shipping_modes: ['me2'], logistic_types: ['self_service'] },
        { id: '2', ml_item_id: 'MLB2', title: 'FLEX', status: 'active', shipping_modes: ['me2'], logistic_types: ['self_service'] },
        { id: '3', ml_item_id: 'MLB3', title: 'FULL', status: 'active', shipping_modes: ['me2'], logistic_types: ['fulfillment'] },
        { id: '4', ml_item_id: 'MLB4', title: 'FULL', status: 'active', shipping_modes: ['me2'], logistic_types: ['fulfillment'] }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      const result = calculator.calculate(products);

      expect(result.total).toBe(4);
      expect(result.flex.count).toBe(2);
      expect(result.flex.percentage).toBe(50);
      expect(result.full.count).toBe(2);
      expect(result.full.percentage).toBe(50);
    });
  });
});

