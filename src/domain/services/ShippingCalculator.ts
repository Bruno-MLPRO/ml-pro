// Serviço de domínio para cálculo de estatísticas de envio
// Centraliza TODA a lógica de cálculo de shipping

import { Product } from '../models/Product';
import type { ShippingStats } from '@/types/metrics';

/**
 * Classe responsável por calcular estatísticas de tipos de envio
 * Implementa a lógica de negócio de forma centralizada
 */
export class ShippingCalculator {
  /**
   * Calcula estatísticas completas de envio para um conjunto de produtos
   * Retorna contagens e porcentagens para cada tipo
   * 
   * IMPORTANTE: Um produto pode contar em MÚLTIPLOS tipos de envio
   * Exemplo: Um produto pode ter ME2 (FLEX) + Custom (Correios) simultaneamente
   */
  calculate(products: Product[]): ShippingStats {
    // Filtrar apenas produtos ativos
    const activeProducts = products.filter(p => p.isActive);
    const total = activeProducts.length;

    // Se não há produtos, retornar estatísticas zeradas
    if (total === 0) {
      return this.createEmptyStats();
    }

    // Contar produtos por tipo
    const counts = this.countByType(activeProducts);

    // Calcular porcentagens
    return {
      flex: {
        count: counts.flex,
        percentage: this.calculatePercentage(counts.flex, total)
      },
      agencies: {
        count: counts.agencies,
        percentage: this.calculatePercentage(counts.agencies, total)
      },
      collection: {
        count: counts.collection,
        percentage: this.calculatePercentage(counts.collection, total)
      },
      full: {
        count: counts.full,
        percentage: this.calculatePercentage(counts.full, total)
      },
      correios: {
        count: counts.correios,
        percentage: this.calculatePercentage(counts.correios, total)
      },
      envio_proprio: {
        count: counts.envio_proprio,
        percentage: this.calculatePercentage(counts.envio_proprio, total)
      },
      total
    };
  }

  /**
   * Calcula estatísticas em formato simplificado (apenas contagens)
   * Mantido por compatibilidade com código legado
   */
  calculateSimple(products: Product[]): {
    flex: number;
    agencies: number;
    collection: number;
    full: number;
    correios: number;
    envio_proprio: number;
    total: number;
  } {
    const stats = this.calculate(products);
    
    return {
      flex: stats.flex.count,
      agencies: stats.agencies.count,
      collection: stats.collection.count,
      full: stats.full.count,
      correios: stats.correios.count,
      envio_proprio: stats.envio_proprio.count,
      total: stats.total
    };
  }

  /**
   * Conta produtos por tipo de envio
   * IMPORTANTE: Um produto pode ser contado em múltiplos tipos
   */
  private countByType(products: Product[]): {
    flex: number;
    agencies: number;
    collection: number;
    full: number;
    correios: number;
    envio_proprio: number;
  } {
    let flex = 0;
    let agencies = 0;
    let collection = 0;
    let full = 0;
    let correios = 0;
    let envio_proprio = 0;

    for (const product of products) {
      // Cada verificação é independente
      // Um produto pode incrementar múltiplos contadores
      if (product.isFlex()) flex++;
      if (product.isAgency()) agencies++;
      if (product.isCollection()) collection++;
      if (product.isFull()) full++;
      if (product.isCorreios()) correios++;
      if (product.isEnvioProprio()) envio_proprio++;
    }

    return {
      flex,
      agencies,
      collection,
      full,
      correios,
      envio_proprio
    };
  }

  /**
   * Calcula porcentagem com segurança contra divisão por zero
   */
  private calculatePercentage(count: number, total: number): number {
    if (total === 0) return 0;
    return (count / total) * 100;
  }

  /**
   * Cria estatísticas zeradas
   */
  private createEmptyStats(): ShippingStats {
    return {
      flex: { count: 0, percentage: 0 },
      agencies: { count: 0, percentage: 0 },
      collection: { count: 0, percentage: 0 },
      full: { count: 0, percentage: 0 },
      correios: { count: 0, percentage: 0 },
      envio_proprio: { count: 0, percentage: 0 },
      total: 0
    };
  }

  /**
   * Calcula estatísticas agregadas de múltiplas coleções de produtos
   * Útil para consolidar dados de múltiplas contas
   */
  calculateAggregated(productCollections: Product[][]): ShippingStats {
    const allProducts = productCollections.flat();
    return this.calculate(allProducts);
  }

  /**
   * Verifica se um produto tem um tipo de envio específico
   * Método utilitário para uso externo
   */
  hasShippingType(
    product: Product,
    type: 'flex' | 'agencies' | 'collection' | 'full' | 'correios' | 'envio_proprio'
  ): boolean {
    switch (type) {
      case 'flex':
        return product.isFlex();
      case 'agencies':
        return product.isAgency();
      case 'collection':
        return product.isCollection();
      case 'full':
        return product.isFull();
      case 'correios':
        return product.isCorreios();
      case 'envio_proprio':
        return product.isEnvioProprio();
      default:
        return false;
    }
  }
}

// Exportar instância singleton para uso conveniente
export const shippingCalculator = new ShippingCalculator();

