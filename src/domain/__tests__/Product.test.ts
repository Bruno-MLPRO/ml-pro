// Testes para validar que a camada de domínio funciona corretamente
// Garante que a refatoração manteve a funcionalidade intacta

import { Product } from '../models/Product';
import type { MLProduct } from '@/types/mercadoLivre';

describe('Product - Domain Model', () => {
  describe('Shipping Mode Detection', () => {
    test('deve identificar produto FLEX corretamente', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '1',
        ml_item_id: 'MLB123',
        title: 'Produto Teste',
        status: 'active',
        shipping_modes: ['me2'],
        logistic_types: ['self_service']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isFlex()).toBe(true);
      expect(product.isAgency()).toBe(false);
      expect(product.isFull()).toBe(false);
    });

    test('deve identificar produto FULL corretamente', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '2',
        ml_item_id: 'MLB456',
        title: 'Produto FULL',
        status: 'active',
        shipping_modes: ['me2'],
        logistic_types: ['fulfillment']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isFull()).toBe(true);
      expect(product.isFlex()).toBe(false);
      expect(product.isCorreios()).toBe(false);
    });

    test('deve identificar Correios com drop_off mode', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '3',
        ml_item_id: 'MLB789',
        title: 'Produto Correios',
        status: 'active',
        shipping_modes: ['drop_off']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isCorreios()).toBe(true);
      expect(product.isFlex()).toBe(false);
    });

    test('deve identificar Correios com ME2 + drop_off type', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '4',
        ml_item_id: 'MLB012',
        title: 'Produto Correios ME2',
        status: 'active',
        shipping_modes: ['me2'],
        logistic_types: ['drop_off']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isCorreios()).toBe(true);
    });

    test('deve identificar Envio Próprio corretamente', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '5',
        ml_item_id: 'MLB345',
        title: 'Produto Envio Próprio',
        status: 'active',
        shipping_modes: ['not_specified']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isEnvioProprio()).toBe(true);
      expect(product.isFlex()).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    test('deve funcionar com formato antigo (shipping_mode único)', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '6',
        ml_item_id: 'MLB678',
        title: 'Produto Antigo',
        status: 'active',
        shipping_mode: 'me2',
        logistic_type: 'self_service'
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isFlex()).toBe(true);
      expect(product.getShippingModes()).toEqual(['me2']);
      expect(product.getLogisticTypes()).toEqual(['self_service']);
    });

    test('deve priorizar shipping_modes sobre shipping_mode', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '7',
        ml_item_id: 'MLB901',
        title: 'Produto Novo',
        status: 'active',
        shipping_mode: 'custom',
        shipping_modes: ['me2', 'drop_off'],
        logistic_type: 'self_service',
        logistic_types: ['self_service', 'xd_drop_off']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      // Deve usar os arrays, não os campos únicos
      expect(product.getShippingModes()).toEqual(['me2', 'drop_off']);
      expect(product.getLogisticTypes()).toEqual(['self_service', 'xd_drop_off']);
    });
  });

  describe('Multiple Shipping Types', () => {
    test('produto pode ter múltiplos tipos de envio', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '8',
        ml_item_id: 'MLB234',
        title: 'Produto Multi',
        status: 'active',
        shipping_modes: ['me2', 'drop_off'],
        logistic_types: ['self_service', 'fulfillment']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      // Este produto é FLEX e FULL e Correios ao mesmo tempo
      expect(product.isFlex()).toBe(true);
      expect(product.isFull()).toBe(true);
      expect(product.isCorreios()).toBe(true);
      
      const allTypes = product.getAllShippingTypes();
      expect(allTypes.length).toBeGreaterThan(1);
    });
  });

  describe('Product Status', () => {
    test('deve filtrar produtos inativos', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '9',
        ml_item_id: 'MLB567',
        title: 'Produto Inativo',
        status: 'paused',
        shipping_modes: ['me2'],
        logistic_types: ['self_service']
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.isActive).toBe(false);
      expect(product.status).toBe('paused');
    });
  });

  describe('Quality Checks', () => {
    test('deve calcular quality score básico', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '10',
        ml_item_id: 'MLB890',
        title: 'Produto Completo',
        status: 'active',
        has_description: true,
        has_pictures: true,
        has_tax_data: true
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      expect(product.hasDescription()).toBe(true);
      expect(product.hasPictures()).toBe(true);
      expect(product.hasTaxData()).toBe(true);
      expect(product.calculateBasicQualityScore()).toBe(100);
    });

    test('deve calcular score parcial', () => {
      const rawProduct: Partial<MLProduct> = {
        id: '11',
        ml_item_id: 'MLB111',
        title: 'Produto Parcial',
        status: 'active',
        has_description: true,
        has_pictures: false,
        has_tax_data: true
      };

      const product = Product.fromRaw(rawProduct as MLProduct);
      
      const score = product.calculateBasicQualityScore();
      expect(score).toBe(67); // 33 + 34
    });
  });

  describe('Array Creation', () => {
    test('deve criar múltiplos produtos a partir de array', () => {
      const rawProducts: Partial<MLProduct>[] = [
        {
          id: '1',
          ml_item_id: 'MLB111',
          title: 'Produto 1',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['self_service']
        },
        {
          id: '2',
          ml_item_id: 'MLB222',
          title: 'Produto 2',
          status: 'active',
          shipping_modes: ['me2'],
          logistic_types: ['fulfillment']
        }
      ];

      const products = Product.fromRawArray(rawProducts as MLProduct[]);
      
      expect(products).toHaveLength(2);
      expect(products[0].isFlex()).toBe(true);
      expect(products[1].isFull()).toBe(true);
    });
  });
});

