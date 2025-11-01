// Mapper para transformação de dados de produtos entre camadas
// Responsável por converter dados brutos em modelos de domínio

import { Product } from '../models/Product';
import type { MLProduct } from '@/types/mercadoLivre';

/**
 * Classe responsável por mapear dados de produtos entre diferentes representações
 */
export class ProductMapper {
  /**
   * Converte dados brutos de produto para modelo de domínio
   */
  toDomain(raw: MLProduct): Product {
    return Product.fromRaw(raw);
  }

  /**
   * Converte array de dados brutos para array de modelos de domínio
   */
  toDomainArray(rawArray: MLProduct[]): Product[] {
    return Product.fromRawArray(rawArray);
  }

  /**
   * Converte modelo de domínio de volta para representação bruta
   * Útil quando precisamos persistir ou enviar dados
   */
  toRaw(product: Product): MLProduct {
    return product.raw;
  }

  /**
   * Converte array de modelos de domínio para array de dados brutos
   */
  toRawArray(products: Product[]): MLProduct[] {
    return products.map(p => this.toRaw(p));
  }

  /**
   * Filtra produtos por status ativo e converte para domínio
   */
  toActiveProducts(rawArray: MLProduct[]): Product[] {
    return rawArray
      .filter(raw => raw.status === 'active')
      .map(raw => this.toDomain(raw));
  }

  /**
   * Agrupa produtos por tipo de envio
   */
  groupByShippingType(products: Product[]): {
    flex: Product[];
    agencies: Product[];
    collection: Product[];
    full: Product[];
    correios: Product[];
    envio_proprio: Product[];
    outros: Product[];
  } {
    const groups = {
      flex: [] as Product[],
      agencies: [] as Product[],
      collection: [] as Product[],
      full: [] as Product[],
      correios: [] as Product[],
      envio_proprio: [] as Product[],
      outros: [] as Product[]
    };

    for (const product of products) {
      // Um produto pode estar em múltiplos grupos
      let counted = false;

      if (product.isFlex()) {
        groups.flex.push(product);
        counted = true;
      }
      if (product.isAgency()) {
        groups.agencies.push(product);
        counted = true;
      }
      if (product.isCollection()) {
        groups.collection.push(product);
        counted = true;
      }
      if (product.isFull()) {
        groups.full.push(product);
        counted = true;
      }
      if (product.isCorreios()) {
        groups.correios.push(product);
        counted = true;
      }
      if (product.isEnvioProprio()) {
        groups.envio_proprio.push(product);
        counted = true;
      }

      // Se não foi contado em nenhum tipo, vai para "outros"
      if (!counted) {
        groups.outros.push(product);
      }
    }

    return groups;
  }
}

// Exportar instância singleton
export const productMapper = new ProductMapper();

