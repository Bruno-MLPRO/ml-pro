import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Home, Image, Package, TrendingUp, DollarSign, ShoppingCart, Award, CheckCircle2, XCircle, AlertTriangle, ExternalLink, FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MLAccount {
  id: string;
  ml_nickname: string;
  is_primary: boolean;
  is_active: boolean;
  connected_at: string;
  last_sync_at: string | null;
}

interface MLMetrics {
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  active_listings: number;
  paused_listings: number;
  total_listings: number;
  reputation_color: string;
  reputation_level: string | null;
  reputation_transactions_total: number;
  positive_ratings_rate: number;
  has_decola: boolean;
  real_reputation_level: string | null;
  protection_end_date: string | null;
  has_full: boolean;
  is_mercado_lider: boolean;
  mercado_lider_level: string | null;
  claims_rate: number;
  claims_value: number;
  delayed_handling_rate: number;
  delayed_handling_value: number;
  cancellations_rate: number;
  cancellations_value: number;
  negative_ratings_rate: number;
  neutral_ratings_rate: number;
}

interface MLProduct {
  id: string;
  title: string;
  thumbnail: string;
  status: string;
  has_low_quality_photos: boolean;
  has_description: boolean;
  has_tax_data: boolean;
  min_photo_dimension: number | null;
  photo_count: number;
  permalink: string;
}

interface MLFullStock {
  id: string;
  ml_item_id: string;
  inventory_id: string;
  available_units: number;
  reserved_units: number;
  inbound_units: number;
  damaged_units: number;
  stock_status: string | null;
  mercado_livre_products?: {
    title: string;
    thumbnail: string;
    permalink: string;
  };
}

export default function MLAccountDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mlAccounts, setMlAccounts] = useState<MLAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"geral" | "anuncios" | "estoque">("geral");
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [fullStock, setFullStock] = useState<MLFullStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [adsFilter, setAdsFilter] = useState<'low_quality_photos' | 'no_description' | 'no_tax_data'>('low_quality_photos');

  useEffect(() => {
    if (user) {
      loadMLAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData(selectedAccountId);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;

    const metricsChannel = supabase
      .channel('ml-metrics-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mercado_livre_metrics',
        filter: `ml_account_id=eq.${selectedAccountId}`
      }, () => {
        loadAccountData(selectedAccountId);
      })
      .subscribe();

    const productsChannel = supabase
      .channel('ml-products-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mercado_livre_products',
        filter: `ml_account_id=eq.${selectedAccountId}`
      }, () => {
        loadAccountData(selectedAccountId);
      })
      .subscribe();

    const stockChannel = supabase
      .channel('ml-stock-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'mercado_livre_full_stock',
        filter: `ml_account_id=eq.${selectedAccountId}`
      }, () => {
        loadAccountData(selectedAccountId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(metricsChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(stockChannel);
    };
  }, [selectedAccountId]);

  const loadMLAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('mercado_livre_accounts')
        .select('id, ml_nickname, is_primary, is_active, connected_at, last_sync_at')
        .eq('student_id', user?.id)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (error) throw error;

      setMlAccounts(data || []);
      
      if (data && data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (error: any) {
      console.error('Error loading ML accounts:', error);
      toast.error('Erro ao carregar contas do Mercado Livre');
    } finally {
      setLoading(false);
    }
  };

  const loadAccountData = async (accountId: string) => {
    setLoading(true);
    try {
      const [metricsResult, productsResult, stockResult] = await Promise.all([
        supabase
          .from('mercado_livre_metrics')
          .select('*')
          .eq('ml_account_id', accountId)
          .order('last_updated', { ascending: false })
          .limit(1)
          .single(),
        
        supabase
          .from('mercado_livre_products')
          .select('*')
          .eq('ml_account_id', accountId)
          .order('title'),
        
        supabase
          .from('mercado_livre_full_stock')
          .select('*')
          .eq('ml_account_id', accountId)
          .order('ml_item_id')
      ]);

      // Enriquecer dados do estoque com informações dos produtos
      const enrichedStock = await Promise.all(
        (stockResult.data || []).map(async (stock) => {
          const { data: product } = await supabase
            .from('mercado_livre_products')
            .select('title, thumbnail, permalink')
            .eq('ml_item_id', stock.ml_item_id)
            .eq('ml_account_id', accountId)
            .single();
          
          return {
            ...stock,
            mercado_livre_products: product || undefined
          };
        })
      );

      if (metricsResult.error) throw metricsResult.error;
      if (productsResult.error) throw productsResult.error;
      if (stockResult.error) throw stockResult.error;

      setMetrics(metricsResult.data);
      setProducts(productsResult.data || []);
      setFullStock(enrichedStock);
    } catch (error: any) {
      console.error('Error loading account data:', error);
      toast.error('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  const totalStockUnits = fullStock.reduce((sum, item) => 
    sum + item.available_units + item.reserved_units + item.inbound_units, 0
  );

  const lowQualityProducts = products.filter(p => p.has_low_quality_photos);
  const noDescriptionProducts = products.filter(p => !p.has_description);
  const noTaxDataProducts = products.filter(p => !p.has_tax_data);

  const lowQualityPercentage = metrics && metrics.total_listings > 0
    ? (lowQualityProducts.length / metrics.total_listings) * 100
    : 0;

  const renderProductList = (
    productsList: MLProduct[], 
    emptyMessage: string,
    infoMessage: (product: MLProduct) => string
  ) => {
    if (productsList.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-medium">Parabéns!</p>
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {productsList.map((product) => (
          <Card key={product.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {product.thumbnail && (
                  <img 
                    src={product.thumbnail} 
                    alt={product.title}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{product.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {infoMessage(product)}
                  </p>
                </div>
                {product.permalink && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(product.permalink!, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Anúncio
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading && mlAccounts.length === 0) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando contas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (mlAccounts.length === 0) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Nenhuma conta conectada</h2>
            <p className="text-muted-foreground mb-4">
              Conecte sua primeira conta do Mercado Livre para ver o dashboard
            </p>
            <Button onClick={() => navigate('/aluno/dashboard')}>
              Ir para Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Dashboard Mercado Livre</h1>
            
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {mlAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    @{account.ml_nickname}
                    {account.is_primary && " (Principal)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="geral">
                <Home className="w-4 h-4 mr-2" />
                Geral
              </TabsTrigger>
              <TabsTrigger value="anuncios">
                <Image className="w-4 h-4 mr-2" />
                Anúncios
              </TabsTrigger>
              <TabsTrigger value="estoque">
                <Package className="w-4 h-4 mr-2" />
                Estoque FULL
              </TabsTrigger>
            </TabsList>

            {/* ABA GERAL */}
            <TabsContent value="geral" className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : metrics ? (
                <>
                  {/* Badges de Status */}
                  <div className="flex flex-wrap gap-3">
                    <Badge variant={metrics.has_decola ? "default" : "outline"} className="px-4 py-2">
                      {metrics.has_decola ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      Decola {metrics.has_decola ? "Ativo" : "Inativo"}
                    </Badge>
                    
                    <Badge variant={metrics.has_full ? "default" : "outline"} className="px-4 py-2">
                      {metrics.has_full ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                      FULL {metrics.has_full ? "Ativo" : "Inativo"}
                    </Badge>
                    
                    {metrics.is_mercado_lider && (
                      <Badge variant="default" className="px-4 py-2">
                        <Award className="w-4 h-4 mr-2" />
                        Mercado Líder {metrics.mercado_lider_level && `- ${metrics.mercado_lider_level}`}
                      </Badge>
                    )}
                  </div>

                  {/* Reputação Real (quando Decola está ativo) */}
                  {metrics.has_decola && metrics.real_reputation_level && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-sm mb-1">Programa Decola Ativo</h4>
                            <p className="text-sm text-muted-foreground">
                              Sua reputação está sendo protegida. Reputação real: <span className="font-semibold capitalize">{metrics.real_reputation_level}</span>
                            </p>
                            {metrics.protection_end_date && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Proteção válida até: {new Date(metrics.protection_end_date).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reputação */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Reputação</h3>
                    <ReputationBadge
                      color={metrics.reputation_color}
                      levelId={metrics.reputation_level}
                      positiveRate={metrics.positive_ratings_rate}
                      totalTransactions={metrics.reputation_transactions_total}
                    />
                  </div>

                  {/* Métricas de Qualidade */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Métricas de Qualidade</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Reclamações</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{(metrics.claims_rate * 100).toFixed(1)}%</div>
                          <p className="text-sm text-muted-foreground">{metrics.claims_value} reclamações</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Atrasos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{(metrics.delayed_handling_rate * 100).toFixed(1)}%</div>
                          <p className="text-sm text-muted-foreground">{metrics.delayed_handling_value} atrasos</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Cancelamentos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{(metrics.cancellations_rate * 100).toFixed(1)}%</div>
                          <p className="text-sm text-muted-foreground">{metrics.cancellations_value} cancelamentos</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  {/* Métricas Financeiras */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Desempenho Financeiro (Últimos 30 dias)</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4" />
                            Total de Vendas
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">{metrics.total_sales}</div>
                          <p className="text-sm text-muted-foreground">vendas realizadas</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Faturamento
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            R$ {metrics.total_revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <p className="text-sm text-muted-foreground">receita total</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Ticket Médio
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold">
                            R$ {metrics.average_ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                          <p className="text-sm text-muted-foreground">valor médio por venda</p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma métrica disponível</p>
                </div>
              )}
            </TabsContent>

            {/* ABA ANÚNCIOS */}
            <TabsContent value="anuncios" className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  {/* Estatísticas */}
                  {metrics && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Anúncios Ativos</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {metrics.active_listings}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Anúncios Pausados</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {metrics.paused_listings}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-medium">Fotos Baixa Qualidade</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {lowQualityPercentage.toFixed(1)}%
                          </div>
                          <p className="text-sm text-muted-foreground">{lowQualityProducts.length} de {metrics.total_listings}</p>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Subnavegação de Anúncios */}
                  <Tabs value={adsFilter} onValueChange={(v) => setAdsFilter(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="low_quality_photos" className="flex items-center gap-2">
                        <Image className="w-4 h-4" />
                        <span className="hidden sm:inline">Fotos &lt; 1200x1200</span>
                        <span className="sm:hidden">Fotos</span>
                        <Badge variant={lowQualityProducts.length > 0 ? "destructive" : "secondary"} className="ml-1">
                          {lowQualityProducts.length}
                        </Badge>
                      </TabsTrigger>
                      
                      <TabsTrigger value="no_description" className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Sem Descrição</span>
                        <span className="sm:hidden">Descrição</span>
                        <Badge variant={noDescriptionProducts.length > 0 ? "destructive" : "secondary"} className="ml-1">
                          {noDescriptionProducts.length}
                        </Badge>
                      </TabsTrigger>
                      
                      <TabsTrigger value="no_tax_data" className="flex items-center gap-2">
                        <Receipt className="w-4 h-4" />
                        <span className="hidden sm:inline">Sem Dados Fiscais</span>
                        <span className="sm:hidden">Fiscais</span>
                        <Badge variant={noTaxDataProducts.length > 0 ? "destructive" : "secondary"} className="ml-1">
                          {noTaxDataProducts.length}
                        </Badge>
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="low_quality_photos" className="mt-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          Produtos com Fotos de Baixa Qualidade
                        </h3>
                        {renderProductList(
                          lowQualityProducts,
                          "Todos os seus anúncios possuem fotos de alta qualidade (≥ 1200x1200px)",
                          (product) => `${product.photo_count} fotos • Menor dimensão: ${product.min_photo_dimension || 'N/A'}px`
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="no_description" className="mt-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-orange-500" />
                          Produtos sem Descrição
                        </h3>
                        {renderProductList(
                          noDescriptionProducts,
                          "Todos os seus anúncios possuem descrição completa",
                          () => "Descrição não preenchida ou muito curta (< 50 caracteres)"
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="no_tax_data" className="mt-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                          <Receipt className="w-5 h-5 text-orange-500" />
                          Produtos sem Dados Fiscais
                        </h3>
                        {renderProductList(
                          noTaxDataProducts,
                          "Todos os seus anúncios possuem dados fiscais completos (NCM + Origem)",
                          () => "Faltam dados fiscais: NCM ou Origem não cadastrados"
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </TabsContent>

            {/* ABA ESTOQUE FULL */}
            <TabsContent value="estoque" className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : fullStock.length > 0 ? (
                <>
                  {/* Resumo de Estoque */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Resumo do Estoque FULL
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Disponíveis</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {fullStock.reduce((sum, item) => sum + item.available_units, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Reservadas</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {fullStock.reduce((sum, item) => sum + item.reserved_units, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Em Trânsito</p>
                          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            {fullStock.reduce((sum, item) => sum + item.inbound_units, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Danificadas</p>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {fullStock.reduce((sum, item) => sum + item.damaged_units, 0)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Total de Unidades</span>
                          <span className="font-medium">{totalStockUnits} unidades</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lista de Produtos no FULL */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Produtos no Estoque FULL</h3>
                    <div className="space-y-2">
                      {fullStock.map((item) => (
                        <Card key={item.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              {/* Foto do Produto */}
                              {item.mercado_livre_products?.thumbnail && (
                                <img 
                                  src={item.mercado_livre_products.thumbnail} 
                                  alt={item.mercado_livre_products.title || 'Produto'}
                                  className="w-20 h-20 object-cover rounded"
                                />
                              )}
                              
                              {/* Informações do Produto */}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium mb-1">
                                  {item.mercado_livre_products?.title || `Item: ${item.ml_item_id}`}
                                </h4>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Item ID: {item.ml_item_id} • Inventário: {item.inventory_id}
                                  {item.stock_status && ` • Status: ${item.stock_status}`}
                                </p>
                                
                                <div className="flex gap-4 text-sm">
                                  <div className="text-center">
                                    <p className="text-green-600 dark:text-green-400 font-bold">{item.available_units}</p>
                                    <p className="text-muted-foreground text-xs">Disponível</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-blue-600 dark:text-blue-400 font-bold">{item.reserved_units}</p>
                                    <p className="text-muted-foreground text-xs">Reservado</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-orange-600 dark:text-orange-400 font-bold">{item.inbound_units}</p>
                                    <p className="text-muted-foreground text-xs">Trânsito</p>
                                  </div>
                                  {item.damaged_units > 0 && (
                                    <div className="text-center">
                                      <p className="text-red-600 dark:text-red-400 font-bold">{item.damaged_units}</p>
                                      <p className="text-muted-foreground text-xs">Danificado</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Botão Ver Anúncio */}
                              {item.mercado_livre_products?.permalink && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(item.mercado_livre_products!.permalink, '_blank')}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Ver Anúncio
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-lg font-medium">Nenhum produto no FULL</p>
                    <p className="text-muted-foreground">
                      Você ainda não possui produtos armazenados no estoque FULL do Mercado Livre
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
