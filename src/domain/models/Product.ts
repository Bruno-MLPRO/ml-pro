// Modelo de domínio para Produto do Mercado Livre
// Centraliza toda a lógica de negócio relacionada a produtos

import type { MLProduct } from '@/types/mercadoLivre';

export type ShippingMode = 'me2' | 'me1' | 'custom' | 'not_specified' | 'drop_off';
export type LogisticType = 'self_service' | 'xd_drop_off' | 'cross_docking' | 'fulfillment' | 'drop_off';

/**
 * Classe de domínio que encapsula a lógica de negócio de um produto
 */
export class Product {
  constructor(private readonly data: MLProduct) {}

  // Getters básicos
  get id(): string {
    return this.data.id;
  }

  get mlItemId(): string {
    return this.data.ml_item_id;
  }

  get title(): string {
    return this.data.title;
  }

  get status(): string {
    return this.data.status;
  }

  get isActive(): boolean {
    return this.data.status === 'active';
  }

  // Acesso ao dado bruto quando necessário
  get raw(): MLProduct {
    return this.data;
  }

  /**
   * Verifica se o produto tem um modo de envio específico
   * Trata tanto o campo legado (shipping_mode) quanto o novo (shipping_modes array)
   */
  hasShippingMode(mode: ShippingMode): boolean {
    const modes = this.getShippingModes();
    return modes.includes(mode);
  }

  /**
   * Retorna todos os modos de envio do produto
   * Compatível com formato antigo e novo
   */
  getShippingModes(): ShippingMode[] {
    // Prioriza shipping_modes (array) se existir
    if (this.data.shipping_modes && this.data.shipping_modes.length > 0) {
      return this.data.shipping_modes as ShippingMode[];
    }
    
    // Fallback para shipping_mode (string único)
    if (this.data.shipping_mode) {
      return [this.data.shipping_mode as ShippingMode];
    }
    
    return [];
  }

  /**
   * Retorna todos os tipos logísticos do produto
   * Compatível com formato antigo e novo
   */
  getLogisticTypes(): LogisticType[] {
    // Prioriza logistic_types (array) se existir
    if (this.data.logistic_types && this.data.logistic_types.length > 0) {
      return this.data.logistic_types as LogisticType[];
    }
    
    // Fallback para logistic_type (string único)
    if (this.data.logistic_type) {
      return [this.data.logistic_type as LogisticType];
    }
    
    return [];
  }

  /**
   * Verifica se o produto tem um tipo logístico específico
   */
  hasLogisticType(type: LogisticType): boolean {
    const types = this.getLogisticTypes();
    return types.includes(type);
  }

  // ========== IDENTIFICADORES DE TIPO DE ENVIO ==========

  /**
   * FLEX = Mercado Envios 2 (ME2) com tipo logístico self_service
   * Vendedor leva aos pontos de coleta FLEX
   */
  isFlex(): boolean {
    return this.hasShippingMode('me2') && this.hasLogisticType('self_service');
  }

  /**
   * AGÊNCIAS = Mercado Envios 2 (ME2) com tipo logístico xd_drop_off
   * Vendedor leva a agências parceiras
   */
  isAgency(): boolean {
    return this.hasShippingMode('me2') && this.hasLogisticType('xd_drop_off');
  }

  /**
   * COLETA = Mercado Envios 2 (ME2) com tipo logístico cross_docking
   * Mercado Livre coleta na casa do vendedor
   */
  isCollection(): boolean {
    return this.hasShippingMode('me2') && this.hasLogisticType('cross_docking');
  }

  /**
   * FULL = Mercado Envios 2 (ME2) com tipo logístico fulfillment
   * Produto armazenado em centro de distribuição do ML
   */
  isFull(): boolean {
    return this.hasShippingMode('me2') && this.hasLogisticType('fulfillment');
  }

  /**
   * CORREIOS = Mercado Envios com drop_off
   * Vendedor leva ao correio ou ponto de entrega
   * Pode ser ME1 (drop_off mode) ou ME2 (drop_off type)
   */
  isCorreios(): boolean {
    // Modo drop_off direto (ME1)
    const hasDropOffMode = this.hasShippingMode('drop_off');
    
    // ME2 com tipo drop_off
    const hasMe2WithDropOff = this.hasShippingMode('me2') && this.hasLogisticType('drop_off');
    
    return hasDropOffMode || hasMe2WithDropOff;
  }

  /**
   * ENVIO PRÓPRIO = Not Specified
   * Vendedor não especifica preço de envio e deve entrar em contato com comprador
   */
  isEnvioProprio(): boolean {
    return this.hasShippingMode('not_specified');
  }

  /**
   * Verifica se o produto é elegível para FULL
   */
  isFullEligible(): boolean {
    return this.data.full_eligible === true;
  }

  /**
   * Retorna uma string descritiva do tipo de envio principal
   */
  getShippingTypeDescription(): string {
    if (this.isFull()) return 'FULL';
    if (this.isFlex()) return 'FLEX';
    if (this.isAgency()) return 'Agências';
    if (this.isCollection()) return 'Coleta';
    if (this.isCorreios()) return 'Correios';
    if (this.isEnvioProprio()) return 'Envio Próprio';
    return 'Outro';
  }

  /**
   * Retorna todos os tipos de envio que este produto suporta
   * Um produto pode ter múltiplos tipos
   */
  getAllShippingTypes(): string[] {
    const types: string[] = [];
    
    if (this.isFull()) types.push('FULL');
    if (this.isFlex()) types.push('FLEX');
    if (this.isAgency()) types.push('Agências');
    if (this.isCollection()) types.push('Coleta');
    if (this.isCorreios()) types.push('Correios');
    if (this.isEnvioProprio()) types.push('Envio Próprio');
    
    return types.length > 0 ? types : ['Outro'];
  }

  // ========== QUALIDADE DO ANÚNCIO ==========

  /**
   * Verifica se o produto tem descrição
   */
  hasDescription(): boolean {
    return this.data.has_description === true;
  }

  /**
   * Verifica se o produto tem fotos
   */
  hasPictures(): boolean {
    return this.data.has_pictures === true;
  }

  /**
   * Verifica se o produto tem dados fiscais
   */
  hasTaxData(): boolean {
    return this.data.has_tax_data === true;
  }

  /**
   * Calcula um score básico de qualidade (0-100)
   */
  calculateBasicQualityScore(): number {
    let score = 0;
    
    if (this.hasDescription()) score += 33;
    if (this.hasPictures()) score += 33;
    if (this.hasTaxData()) score += 34;
    
    return score;
  }

  // ========== MÉTODOS DE CRIAÇÃO ==========

  /**
   * Cria uma instância de Product a partir de dados brutos
   */
  static fromRaw(data: MLProduct): Product {
    return new Product(data);
  }

  /**
   * Cria múltiplas instâncias de Product a partir de um array
   */
  static fromRawArray(dataArray: MLProduct[]): Product[] {
    return dataArray.map(data => Product.fromRaw(data));
  }
}

