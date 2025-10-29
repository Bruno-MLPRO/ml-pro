import { useMemo, useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, TrendingDown, TrendingUp, Minus, ExternalLink, LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AnalysisResult from '@/components/AnalysisResult';
import { useAuth } from '@/hooks/useAuth';

type PersonaConfig = {
  slug: 'conservative' | 'balanced' | 'aggressive';
  name: string;
  description: string;
  icon: ReactNode;
  iconComponent: LucideIcon;
  bgColor: string;
  borderColor: string;
  textColor: string;
  color: string;
};

const personas: ReadonlyArray<PersonaConfig> = [
  {
    slug: 'conservative',
    name: 'Murillo',
    description:
      'Prioriza segurança e retorno estável. Evita riscos e prefere produtos com histórico comprovado. Prefere produtos com menos vendas totais e ticket mais alto que terão menos competitividade, com o objetivo de manter margem de lucro maior, mesmo que demore mais para vender o estoque.',
    icon: <TrendingDown className="w-6 h-6 text-blue-600" />,
    iconComponent: TrendingDown,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    textColor: 'text-blue-600',
    color: 'blue'
  },
  {
    slug: 'balanced',
    name: 'Stefan',
    description: 'Busca equilíbrio entre risco e retorno. Analisa cuidadosamente cada oportunidade. Busca oportunidades em produtos validados com alta procura e margem constante, preferindo produtos genéricos de importação e o uso de ads nos anúncios.',
    icon: <Minus className="w-6 h-6 text-yellow-600" />,
    iconComponent: Minus,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-500',
    textColor: 'text-yellow-600',
    color: 'yellow'
  },
  {
    slug: 'aggressive',
    name: 'Bruno',
    description: 'Aceita riscos maiores em busca de retornos superiores. Foca em oportunidades de crescimento. Procura diversificar oportunidades de "venda rápida" para um lucro rápido em diversos SKUs com pouco estoque antes do CUT.',
    icon: <TrendingUp className="w-6 h-6 text-red-600" />,
    iconComponent: TrendingUp,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    textColor: 'text-red-600',
    color: 'red'
  }
];

type FunctionResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

type CompetitorInfo = {
  item_id: string;
  seller_id: number;
  price: number;
  available_quantity?: number;
  sold_quantity?: number;
  listing_type?: string;
  shipping?: {
    logistic_type?: string;
    mode?: string;
    free_shipping?: boolean;
  };
  visits_total?: number;
  reputation?: string;
  is_buy_box_winner?: boolean;
};

type ProductDetails = {
  title: string;
  price: number;
  brand?: string;
  sold_quantity?: number;
  available_quantity?: number;
  condition?: string;
  daily_visits?: number;
  monthly_visits?: number;
  conversion_rate?: number;
  competitors?: CompetitorInfo[];
  permalink?: string;
  source?: 'item' | 'catalog' | 'search';
  seller?: {
    reputation?: string;
  };
  [key: string]: any;
};

type AnalysisPayload = {
  analysis_id: string;
  persona: string;
  recommendation: string;
  confidence_score: number;
  analysis_text: string;
  key_metrics: {
    profit_margin: string;
    roi: string;
    net_profit: string;
    risk_score: string;
  };
  created_at: string;
};

const sourceLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  item: { label: 'Anúncio direto', variant: 'default' },
  catalog: { label: 'Catálogo (Buy Box)', variant: 'secondary' },
  search: { label: 'Catálogo (via busca)', variant: 'outline' }
};

const normalizeFunctionResponse = <T,>(raw: any): FunctionResponse<T> | null => {
  if (!raw) return null;
  if (typeof raw.success !== 'undefined') return raw as FunctionResponse<T>;
  if (raw.data && typeof raw.data.success !== 'undefined') {
    return raw.data as FunctionResponse<T>;
  }
  return null;
};

export default function ConsultantBoard() {
  const [selectedPersona, setSelectedPersona] = useState('');
  const [productLink, setProductLink] = useState('');
  const [productCost, setProductCost] = useState('');
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'fetching_product' | 'analyzing' | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }),
    []
  );

  const handleFetchProduct = async () => {
    const trimmedInput = productLink.trim();
    if (!trimmedInput) {
      toast({
        title: 'Informe o ID ou link',
        description: 'Digite o código ou cole o link do anúncio/catálogo para buscar.',
        variant: 'destructive',
      });
      return;
    }

    setProductLoading(true);
    setCurrentStep('fetching_product');
    setAnalysis(null);

    try {
      const studentId = user?.id;
      if (!studentId) {
        throw new Error('Você precisa estar logado para buscar produtos.');
      }

      // Buscar token ML do usuário
      const { data: mlAccount } = await supabase
        .from('mercado_livre_accounts')
        .select('access_token')
        .eq('student_id', studentId)
        .eq('is_primary', true)
        .single();

      const mlToken = mlAccount?.access_token;

      // Normalizar ID
      const normalizeId = (input: string): string => {
        const trimmed = input.trim();
        if (trimmed.toLowerCase().startsWith('http')) {
          const match = trimmed.match(/(ML[ABM]-?\d+)/i);
          return match ? match[1].toUpperCase().replace('-', '') : '';
        }
        if (/^ML[ABM]\d+$/i.test(trimmed)) return trimmed.toUpperCase();
        if (/^\d+$/.test(trimmed)) return `MLB${trimmed}`;
        return trimmed.toUpperCase();
      };

      const productId = normalizeId(trimmedInput);

      // Buscar catálogo via proxy
      const catalogProxyReq = await supabase.functions.invoke('ml-proxy', {
        body: {
          url: `https://api.mercadolibre.com/products/${productId}`,
          authorization: mlToken ? `Bearer ${mlToken}` : undefined
        }
      });

      if (!catalogProxyReq.data?.success) {
        throw new Error('Catálogo não encontrado');
      }

      const catalogData = catalogProxyReq.data.data;
      console.log('📦 Catálogo:', catalogData.name);

      // Buscar competidores via proxy
      const searchQuery = encodeURIComponent(catalogData.name?.substring(0, 60) || '');
      const searchProxyReq = await supabase.functions.invoke('ml-proxy', {
        body: {
          url: `https://api.mercadolibre.com/sites/MLB/search?q=${searchQuery}&limit=20`,
          authorization: mlToken ? `Bearer ${mlToken}` : undefined
        }
      });

      const competitors = searchProxyReq.data?.success ? (searchProxyReq.data.data.results || []) : [];
      console.log(`✅ Competidores: ${competitors.length}`);

      // Buscar visitas via proxy
      const itemIds = competitors.slice(0, 20).map((c: any) => c.id).join(',');
      let totalVisits = 0;

      if (itemIds) {
        const visitsProxyReq = await supabase.functions.invoke('ml-proxy', {
          body: {
            url: `https://api.mercadolibre.com/visits/items?ids=${itemIds}`,
            authorization: mlToken ? `Bearer ${mlToken}` : undefined
          }
        });

        if (visitsProxyReq.data?.success) {
          const visitsData = visitsProxyReq.data.data;
          totalVisits = Object.values(visitsData as Record<string, number>).reduce(
            (sum: number, v: any) => sum + (typeof v === 'number' ? v : 0), 0
          );
        }
      }

      // Calcular métricas
      const prices = competitors.map((c: any) => c.price).filter((p: number) => p > 0);
      const avgPrice = prices.length > 0
        ? Math.round(prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length)
        : 0;

      const totalSold = competitors.reduce((sum: number, c: any) => sum + (c.sold_quantity || 0), 0);

      const productDetails: ProductDetails = {
        title: catalogData.name,
        price: avgPrice,
        brand: catalogData.attributes?.find((a: any) => a.id === 'BRAND')?.value_name,
        sold_quantity: totalSold,
        available_quantity: competitors.reduce((sum: number, c: any) => sum + (c.available_quantity || 0), 0),
        condition: 'new',
        daily_visits: Math.round(totalVisits / 730),
        monthly_visits: Math.round(totalVisits / 24),
        conversion_rate: totalVisits > 0 ? parseFloat(((totalSold / totalVisits) * 100).toFixed(2)) : 0,
        competitors: competitors.slice(0, 20).map((c: any) => ({
          item_id: c.id,
          seller_id: c.seller?.id || 0,
          price: c.price,
          available_quantity: c.available_quantity,
          sold_quantity: c.sold_quantity,
          listing_type: c.listing_type_id,
          shipping: c.shipping,
          visits_total: 0,
          reputation: c.seller?.seller_reputation?.level_id,
          is_buy_box_winner: false
        })),
        permalink: catalogData.permalink || `https://www.mercadolivre.com.br/p/${productId}`,
        source: 'catalog'
      };

      setProductDetails(productDetails);
      setSelectedPersona('');
      setProductCost('');

      toast({
        title: 'Catálogo encontrado!',
        description: `${productDetails.title} - ${competitors.length} vendedores`
      });

    } catch (err: any) {
      console.error('Erro ao buscar produto:', err);

      toast({
        title: 'Erro ao buscar produto',
        description: err.message || 'Não foi possível carregar o produto',
        variant: 'destructive'
      });

      setProductDetails(null);
    } finally {
      setProductLoading(false);
      setCurrentStep(null);
    }
  };

  const handleAnalyze = async () => {
    if (!productDetails) {
      toast({
        title: 'Busque um produto primeiro',
        description: 'Carregue os dados antes de solicitar a análise',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedPersona || !productCost) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione uma persona e informe o custo do produto',
        variant: 'destructive'
      });
      return;
    }

    const cost = parseFloat(productCost);
    if (Number.isNaN(cost) || cost <= 0) {
      toast({
        title: 'Custo inválido',
        description: 'Informe um valor maior que zero',
        variant: 'destructive'
      });
      return;
    }

    setAnalysisLoading(true);
    setCurrentStep('analyzing');
    setAnalysis(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const studentId = userData?.user?.id;

      if (!studentId) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('consultant-analyze-product', {
        body: {
          personaSlug: selectedPersona,
          productData: productDetails,
          productCost: cost,
          studentId
        }
      });

      console.log('Analysis Data Response:', data);

      if (error) throw error;

      const parsed = normalizeFunctionResponse<AnalysisPayload>(data);

      if (!parsed?.success) {
        throw new Error(parsed?.error || 'Erro ao realizar análise');
      }

      setAnalysis(parsed.data);

      toast({
        title: '✅ Análise concluída!',
        description: 'Confira a recomendação abaixo'
      });
    } catch (err: any) {
      console.error('Erro na análise:', err);
      const message = err.message || err.toString() || 'Ocorreu um erro inesperado';

      toast({
        title: 'Erro na análise',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setAnalysisLoading(false);
      setCurrentStep(null);
    }
  };

  const renderProductDetails = () => {
    if (!productDetails) {
      return null;
    }

    const competitors = Array.isArray(productDetails.competitors)
      ? productDetails.competitors
      : [];

    const sourceMeta = productDetails.source
      ? sourceLabels[productDetails.source] || sourceLabels.item
      : sourceLabels.item;

    return (
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{productDetails.title}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
              <span>{productDetails.brand || 'Marca não informada'}</span>
              {productDetails.permalink && (
                <Button variant="link" size="sm" className="px-0" asChild>
                  <a href={productDetails.permalink} target="_blank" rel="noopener noreferrer">
                    Ver anúncio <ExternalLink className="ml-1 h-3 w-3" />
                  </a>
                </Button>
              )}
            </CardDescription>
          </div>
          <Badge variant={sourceMeta.variant}>{sourceMeta.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Preço atual</p>
              <p className="text-lg font-semibold">
                {currencyFormatter.format(productDetails.price ?? 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vendas totais</p>
              <p className="text-lg font-semibold">{productDetails.sold_quantity ?? 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Visitas estimadas (30d)</p>
              <p className="text-lg font-semibold">{productDetails.monthly_visits ?? 'N/D'}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Visitas diárias (média)</p>
              <p className="text-base font-medium">
                {productDetails.daily_visits ? productDetails.daily_visits.toLocaleString('pt-BR') : 'N/D'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Taxa de conversão</p>
              <p className="text-base font-medium">
                {productDetails.conversion_rate ? `${productDetails.conversion_rate}%` : 'N/D'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Concorrentes avaliados</p>
              <p className="text-base font-medium">{competitors.length}</p>
            </div>
          </div>

          {competitors.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Anúncios do catálogo</p>
                  <p className="text-xs text-muted-foreground">
                    {competitors.length} anúncio{competitors.length !== 1 ? 's' : ''} encontrado{competitors.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Vendedor</th>
                      <th className="px-3 py-2 text-right font-medium">Preço</th>
                      <th className="px-3 py-2 text-right font-medium">Vendidos</th>
                      <th className="px-3 py-2 text-right font-medium">Visitas</th>
                      <th className="px-3 py-2 text-center font-medium">Desde</th>
                      <th className="px-3 py-2 text-center font-medium">Frete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {competitors.map((competitor, index) => {
                      const reputationColor = 
                        competitor.reputation === '5_green' || competitor.reputation === 'green' 
                          ? 'bg-green-500' 
                          : competitor.reputation === '4_light_green'
                          ? 'bg-lime-500'
                          : competitor.reputation === '3_yellow'
                          ? 'bg-yellow-500'
                          : competitor.reputation === '2_orange'
                          ? 'bg-orange-500'
                          : competitor.reputation === '1_red' || competitor.reputation === 'red'
                          ? 'bg-red-500'
                          : 'bg-gray-400';

                      const isBuyBox = competitor.is_buy_box_winner;
                      const isTopSeller = index === 0 && !isBuyBox;
                      
                      return (
                        <tr 
                          key={competitor.item_id}
                          className={cn(
                            'hover:bg-muted/50 transition-colors',
                            isBuyBox && 'bg-blue-50/50 dark:bg-blue-950/20'
                          )}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {isBuyBox && (
                                <Badge variant="default" className="bg-blue-600 text-white text-xs px-1.5 py-0">
                                  Buy Box
                                </Badge>
                              )}
                              {isTopSeller && (
                                <Badge variant="outline" className="text-xs px-1.5 py-0">
                                  + Vendas
                                </Badge>
                              )}
                              <div className="flex items-center gap-1.5">
                                <div 
                                  className={cn('h-2 w-2 rounded-full', reputationColor)}
                                  title={`Reputação: ${competitor.reputation || 'N/D'}`}
                                />
                                <span className="text-xs text-muted-foreground">
                                  #{competitor.seller_id}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold">
                            {currencyFormatter.format(competitor.price)}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-medium">{competitor.sold_quantity || 0}</span>
                              {competitor.sold_quantity > 0 && (
                                <span className="text-xs text-muted-foreground">
                                  {(competitor.sold_quantity / 30).toFixed(1)}/dia
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {competitor.visits_total != null ? (
                              <div className="flex flex-col items-end">
                                <span className="font-medium">
                                  {competitor.visits_total.toLocaleString('pt-BR')}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ~{Math.round(competitor.visits_total / 730)}/dia
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">N/D</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="text-xs text-muted-foreground">
                              há 1 mês
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {competitor.shipping?.free_shipping ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                Grátis
                              </Badge>
                            ) : competitor.shipping?.logistic_type === 'fulfillment' ? (
                              <Badge variant="outline" className="text-xs">
                                Full
                              </Badge>
                            ) : competitor.shipping?.logistic_type === 'cross_docking' ? (
                              <Badge variant="outline" className="text-xs">
                                Flex
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">Normal</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {competitors.length > 10 && (
                <p className="text-xs text-center text-muted-foreground">
                  Mostrando todos os {competitors.length} anúncios encontrados
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="container mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Board Consultivo</h1>
            <p className="text-muted-foreground">
              Análise inteligente de produtos para revenda no Mercado Livre
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>1. Buscar Dados do Produto</CardTitle>
              <CardDescription>
                Informe o link do catálogo ou anúncio no Mercado Livre para carregar os dados automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productLink">ID ou Link do Anúncio/Catálogo</Label>
                <Input
                  id="productLink"
                  placeholder="Cole o link ou digite o ID (ex: MLB123456789)"
                  value={productLink}
                  onChange={(event) => setProductLink(event.target.value)}
                />
              </div>
              <Button
                onClick={handleFetchProduct}
                disabled={productLoading}
                className="w-full"
              >
                {productLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentStep === 'fetching_product' ? 'Buscando produto...' : 'Carregar informações'}
              </Button>
            </CardContent>
          </Card>

          {renderProductDetails()}

          <Card className={cn(!productDetails && 'pointer-events-none opacity-60')}>
            <CardHeader>
              <CardTitle>2. Selecionar Gestor e Enviar para Análise</CardTitle>
              <CardDescription>
                Escolha a persona e informe o custo para receber uma recomendação personalizada
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!productDetails && (
                <p className="text-sm text-muted-foreground">
                  Busque um produto para liberar esta etapa.
                </p>
              )}

              <div className="space-y-2">
                <Label>Escolha seu Gestor</Label>
                <RadioGroup value={selectedPersona} onValueChange={setSelectedPersona}>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {personas.map((persona) => {
                      const Icon = persona.iconComponent;
                      const isSelected = selectedPersona === persona.slug;

                      return (
                        <Label
                          key={persona.slug}
                          htmlFor={persona.slug}
                          className={cn(
                            'flex flex-col space-y-3 rounded-lg border-2 p-4 transition-all',
                            'cursor-pointer hover:border-gray-300',
                            isSelected && `${persona.borderColor} ${persona.bgColor}`
                          )}
                        >
                          <div className="flex items-center space-x-3">
                            <RadioGroupItem value={persona.slug} id={persona.slug} />
                            <span className={cn('font-semibold', isSelected && persona.textColor)}>
                              {persona.name}
                            </span>
                            <Badge variant={isSelected ? 'default' : 'outline'} className={cn(isSelected && persona.textColor)}>
                              {persona.slug === 'conservative' ? 'Conservador' : persona.slug === 'balanced' ? 'Equilibrado' : 'Arrojado'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{persona.description}</p>
                        </Label>
                      );
                    })}
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productCost">Custo do Produto (R$)</Label>
                <Input
                  id="productCost"
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={productCost}
                  onChange={(event) => setProductCost(event.target.value)}
                />
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={analysisLoading || !productDetails || !selectedPersona}
                className="w-full"
              >
                {analysisLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {currentStep === 'analyzing' ? 'Analisando com IA...' : 'Gerar Análise Consultiva'}
              </Button>
            </CardContent>
          </Card>

          {analysis && selectedPersona && productDetails && (
            <AnalysisResult
              analysis={analysis}
              personaSlug={selectedPersona}
              personaData={personas.find((persona) => persona.slug === selectedPersona)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

