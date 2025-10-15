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
import { Home, Image, Package, TrendingUp, DollarSign, ShoppingCart, Award, CheckCircle2, XCircle, AlertTriangle, ExternalLink, FileText, Receipt, MapPin, Truck, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthDashboard } from "@/components/ml-health/HealthDashboard";
import { HealthIndividual } from "@/components/ml-health/HealthIndividual";

interface MLAccount {
  id: string;
  ml_nickname: string;
  is_primary: boolean;
  is_active: boolean;
  connected_at: string;
  last_sync_at: string | null;
  token_expires_at: string;
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
  decola_problems_count: number;
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

interface HealthGoal {
  id: string;
  name: string;
  progress: number;
  progress_max: number;
  apply: boolean;
  completed?: string;
}

interface ItemHealth {
  health_score: number;
  health_level: string;
  goals: HealthGoal[];
  goals_completed: number;
  goals_applicable: number;
  score_trend: string;
  previous_score?: number;
}

interface MLProduct {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string;
  status: string;
  has_low_quality_photos: boolean;
  has_description: boolean;
  has_tax_data: boolean;
  min_photo_dimension: number | null;
  photo_count: number;
  permalink: string;
  shipping_mode: string | null;
  logistic_type: string | null;
  health?: ItemHealth;
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

interface ShippingStats {
  flex: number;
  agencies: number;
  collection: number;
  full: number;
  own: number;
  total: number;
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
  const [shippingStats, setShippingStats] = useState<ShippingStats | null>(null);
  const [healthSubTab, setHealthSubTab] = useState<'dashboard' | 'individual'>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [itemHistory, setItemHistory] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadMLAccounts();
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    if (params.get('ml_connected') === 'true') {
      const nickname = params.get('nickname');
      const isNew = params.get('is_new') === 'true';
      
      toast.success('✅ Conta Conectada!', {
        description: `${nickname} foi ${isNew ? 'conectada' : 'reconectada'} com sucesso. Sincronizando dados...`,
      });
      
      window.history.replaceState({}, '', window.location.pathname);
      
      setTimeout(() => {
        loadMLAccounts();
      }, 1000);
    }
    
    if (params.get('ml_error')) {
      const error = params.get('ml_error');
      toast.error('❌ Erro ao Conectar', {
        description: error || 'Ocorreu um erro desconhecido',
      });
      
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    if (params.get('ml_already_processed') === 'true') {
      toast.warning('⚠️ Conta Já Processada', {
        description: 'Esta conexão já foi processada anteriormente.',
      });
      
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

    const healthChannel = supabase
      .channel('ml-health-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mercado_livre_item_health',
        filter: `ml_account_id=eq.${selectedAccountId}`
      }, (payload) => {
        const newData = payload.new as any;
        const oldData = payload.old as any;
        
        if (newData.health_score < 0.5 && oldData.health_score >= 0.5) {
          toast.error('⚠️ Atenção! Qualidade Crítica', {
            description: `Um anúncio caiu para score crítico (${(newData.health_score * 100).toFixed(0)}%)`,
          });
        }
        
        if (newData.health_score - oldData.health_score >= 0.1) {
          toast.success('🎉 Parabéns! Melhoria Detectada', {
            description: `O score aumentou ${((newData.health_score - oldData.health_score) * 100).toFixed(0)}%!`
          });
        }
        
        if (newData.goals_completed > oldData.goals_completed) {
          toast.success('✅ Objetivo Completado!', {
            description: 'Você completou mais um objetivo de qualidade'
          });
        }
        
        loadAccountData(selectedAccountId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(metricsChannel);
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(healthChannel);
    };
  }, [selectedAccountId]);

  const calculateShippingStats = (products: MLProduct[]): ShippingStats => {
    const activeProducts = products.filter(p => p.status === 'active');
    const total = activeProducts.length;
    
    const flex = activeProducts.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'drop_off'
    ).length;
    
    const agencies = activeProducts.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'xd_drop_off'
    ).length;
    
    const collection = activeProducts.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'cross_docking'
    ).length;
    
    const full = activeProducts.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'fulfillment'
    ).length;
    
    const own = total - (flex + agencies + collection + full);
    
    return { flex, agencies, collection, full, own, total };
  };

  const loadMLAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('mercado_livre_accounts')
        .select('id, ml_nickname, is_primary, is_active, connected_at, last_sync_at, token_expires_at')
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
      const [metricsResult, productsResult, stockResult, healthResult, historyResult] = await Promise.all([
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
          .order('ml_item_id'),
        
        supabase
          .from('mercado_livre_item_health')
          .select('*')
          .eq('ml_account_id', accountId),
        
        supabase
          .from('mercado_livre_health_history')
          .select('*')
          .eq('ml_account_id', accountId)
          .gte('recorded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('recorded_at', { ascending: true })
      ]);

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

      const healthMap = new Map((healthResult.data || []).map(h => [h.ml_item_id, h]));
      
      const productsWithHealth = (productsResult.data || []).map(product => ({
        ...product,
        health: healthMap.get(product.ml_item_id) ? {
          health_score: healthMap.get(product.ml_item_id)!.health_score,
          health_level: healthMap.get(product.ml_item_id)!.health_level,
          goals: healthMap.get(product.ml_item_id)!.goals as unknown as HealthGoal[],
          goals_completed: healthMap.get(product.ml_item_id)!.goals_completed,
          goals_applicable: healthMap.get(product.ml_item_id)!.goals_applicable,
          score_trend: healthMap.get(product.ml_item_id)!.score_trend,
          previous_score: healthMap.get(product.ml_item_id)!.previous_score,
        } : undefined
      }));

      setMetrics(metricsResult.data);
      setProducts(productsWithHealth);
      setFullStock(enrichedStock);
      
      const stats = calculateShippingStats(productsWithHealth);
      setShippingStats(stats);
      
      const historyByDate = new Map<string, number[]>();
      (historyResult.data || []).forEach(record => {
        const date = new Date(record.recorded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!historyByDate.has(date)) {
          historyByDate.set(date, []);
        }
        historyByDate.get(date)!.push(record.health_score);
      });
      
      const aggregatedHistory = Array.from(historyByDate.entries()).map(([date, scores]) => ({
        date,
        averageScore: (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100
      }));
      
      setHealthHistory(aggregatedHistory);
      
      if (selectedItemId) {
        const itemHistoryData = (historyResult.data || [])
          .filter(h => h.ml_item_id === selectedItemId)
          .map(h => ({
            date: new Date(h.recorded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
            score: h.health_score * 100
          }));
        setItemHistory(itemHistoryData);
      }
    } catch (error: any) {
      console.error('Error loading account data:', error);
      toast.error('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  const syncItemHealth = async (itemId?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-get-item-health', {
        body: { 
          ml_account_id: selectedAccountId,
          item_id: itemId
        }
      });
      
      if (error) {
        console.error('Error syncing health:', error);
        
        // Mensagens específicas baseadas no erro
        if (error.message?.includes('Token expirado')) {
          toast.error('Token do Mercado Livre Expirado', {
            description: 'Reconecte sua conta para continuar sincronizando dados.',
          });
        } else if (error.message?.includes('renovar')) {
          toast.error('Erro na Renovação do Token', {
            description: 'Não foi possível renovar automaticamente. Tente reconectar sua conta.',
          });
        } else {
          toast.error('Erro ao Sincronizar', {
            description: error.message || 'Ocorreu um erro desconhecido'
          });
        }
        return;
      }
      
      // Processar resposta de sucesso
      const successCount = data?.synced_count || 0;
      const failedCount = data?.failed_count || 0;
      const totalCount = data?.total_count || 0;
      
      if (successCount === 0 && totalCount > 0) {
        toast.error('Nenhum Anúncio Sincronizado', {
          description: `${failedCount} de ${totalCount} anúncios falharam. Verifique os logs.`
        });
      } else if (failedCount > 0) {
        toast.warning('Sincronização Parcial', {
          description: `${successCount} de ${totalCount} anúncios sincronizados. ${failedCount} falharam.`
        });
      } else {
        toast.success('✅ Performance Atualizada!', {
          description: `${successCount} anúncios sincronizados com sucesso.`
        });
      }
      
      await loadAccountData(selectedAccountId);
      
    } catch (error: any) {
      console.error('Error syncing health:', error);
      toast.error('Erro Fatal', {
        description: 'Não foi possível completar a sincronização.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setHealthSubTab('individual');
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
                    <Badge 
                      variant={metrics.has_full ? "default" : "outline"}
                      className={metrics.has_full ? "px-4 py-2 bg-orange-500 hover:bg-orange-600" : "px-4 py-2"}
                    >
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

                  {/* Programa Decola */}
                  {metrics.has_decola && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1">Programa Decola Ativo</h4>
                              <p className="text-sm text-muted-foreground">
                                Sua reputação está sendo protegida.
                              </p>
                            </div>
                          </div>

                          {/* Contador de Problemas */}
                          <div className="space-y-2 pl-8">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Problemas no Programa</span>
                              <span className={`text-sm font-bold ${
                                metrics.decola_problems_count >= 4 ? 'text-red-500' :
                                metrics.decola_problems_count >= 3 ? 'text-orange-500' :
                                'text-green-500'
                              }`}>
                                {metrics.decola_problems_count}/5
                              </span>
                            </div>
                            
                            <Progress 
                              value={(metrics.decola_problems_count / 5) * 100} 
                              className={`h-2 ${
                                metrics.decola_problems_count >= 4 ? '[&>div]:bg-red-500' :
                                metrics.decola_problems_count >= 3 ? '[&>div]:bg-orange-500' :
                                '[&>div]:bg-green-500'
                              }`}
                            />
                            
                            {metrics.decola_problems_count >= 4 && (
                              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Atenção! Você está próximo do limite de problemas.
                              </p>
                            )}
                            
                            <p className="text-xs text-muted-foreground">
                              Ao atingir 5 problemas (reclamações + atrasos + cancelamentos), 
                              o Programa Decola será encerrado e sua reputação real será exibida.
                            </p>
                          </div>

                          {/* Data de expiração */}
                          {metrics.protection_end_date && (
                            <div className="pl-8 pt-2 border-t">
                              <p className="text-xs text-muted-foreground">
                                Proteção válida até: {new Date(metrics.protection_end_date).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}

                          {/* Reputação Real */}
                          {metrics.real_reputation_level && (
                            <div className="pl-8 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-2">Reputação Real:</p>
                              <ReputationBadge
                                color={metrics.real_reputation_level}
                                levelId={null}
                                positiveRate={metrics.positive_ratings_rate}
                                totalTransactions={metrics.reputation_transactions_total}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Reputação */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Reputação</CardTitle>
                        <Badge 
                          variant={metrics.has_decola ? "default" : "outline"}
                          className="ml-auto"
                        >
                          {metrics.has_decola ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                          Decola {metrics.has_decola ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ReputationBadge
                        color={metrics.reputation_color}
                        levelId={metrics.reputation_level}
                        positiveRate={metrics.positive_ratings_rate}
                        totalTransactions={metrics.reputation_transactions_total}
                      />
                    </CardContent>
                  </Card>

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

                  {/* Tipos de Envio */}
                  {shippingStats && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-4">Tipos de Envio</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Distribuição de anúncios por modalidade de envio Mercado Livre
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Badge FLEX */}
                        {shippingStats.flex > 0 ? (
                          <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-blue-400" />
                                <span className="font-semibold">FLEX</span>
                              </div>
                              <Badge className="bg-blue-500">
                                {shippingStats.flex} produto{shippingStats.flex !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(shippingStats.flex / shippingStats.total) * 100} className="h-1 flex-1" />
                              <span className="text-xs font-medium">{((shippingStats.flex / shippingStats.total) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-muted-foreground" />
                                <span className="font-semibold text-muted-foreground">FLEX</span>
                              </div>
                              <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                            </div>
                            
                          </div>
                        )}
                        
                        {/* Badge Agências */}
                        {shippingStats.agencies > 0 ? (
                          <div className="p-4 rounded-lg border border-purple-500/50 bg-purple-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-purple-400" />
                                <span className="font-semibold">Agências</span>
                              </div>
                              <Badge className="bg-purple-500">
                                {shippingStats.agencies} produto{shippingStats.agencies !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(shippingStats.agencies / shippingStats.total) * 100} className="h-1 flex-1" />
                              <span className="text-xs font-medium">{((shippingStats.agencies / shippingStats.total) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-muted-foreground" />
                                <span className="font-semibold text-muted-foreground">Agências</span>
                              </div>
                              <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                            </div>
                            
                          </div>
                        )}
                        
                        {/* Badge Coleta */}
                        {shippingStats.collection > 0 ? (
                          <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Truck className="w-5 h-5 text-green-400" />
                                <span className="font-semibold">Coleta</span>
                              </div>
                              <Badge className="bg-green-500">
                                {shippingStats.collection} produto{shippingStats.collection !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(shippingStats.collection / shippingStats.total) * 100} className="h-1 flex-1" />
                              <span className="text-xs font-medium">{((shippingStats.collection / shippingStats.total) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Truck className="w-5 h-5 text-muted-foreground" />
                                <span className="font-semibold text-muted-foreground">Coleta</span>
                              </div>
                              <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                            </div>
                            
                          </div>
                        )}
                        
                        {/* Badge FULL */}
                        {shippingStats.full > 0 ? (
                          <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Warehouse className="w-5 h-5 text-orange-400" />
                                <span className="font-semibold">FULL</span>
                              </div>
                              <Badge className="bg-orange-500">
                                {shippingStats.full} produto{shippingStats.full !== 1 ? 's' : ''}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={(shippingStats.full / shippingStats.total) * 100} className="h-1 flex-1" />
                              <span className="text-xs font-medium">{((shippingStats.full / shippingStats.total) * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Warehouse className="w-5 h-5 text-muted-foreground" />
                                <span className="font-semibold text-muted-foreground">FULL</span>
                              </div>
                              <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                            </div>
                            
                          </div>
                        )}
                      </div>
                      
                      {/* Resumo */}
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Total de anúncios ativos</span>
                          <span className="font-semibold">{shippingStats.total}</span>
                        </div>
                        {shippingStats.own > 0 && (
                          <div className="flex items-center justify-between text-sm mt-2">
                            <span className="text-muted-foreground">Envio próprio</span>
                            <span>{shippingStats.own} ({((shippingStats.own / shippingStats.total) * 100).toFixed(0)}%)</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Nenhuma métrica disponível</p>
                </div>
              )}
            </TabsContent>

            {/* ABA PERFORMANCE DE ANÚNCIOS */}
            <TabsContent value="anuncios" className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <Tabs value={healthSubTab} onValueChange={(v) => setHealthSubTab(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dashboard">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Dashboard Geral
                    </TabsTrigger>
                    <TabsTrigger value="individual">
                      <Image className="w-4 h-4 mr-2" />
                      Análise Individual
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dashboard" className="mt-6">
                    <HealthDashboard 
                      products={products}
                      historyData={healthHistory}
                      onSelectItem={handleSelectItem}
                      onSync={() => syncItemHealth()}
                      loading={loading}
                      selectedAccount={mlAccounts.find(a => a.id === selectedAccountId)}
                    />
                    
                    {/* Seção existente de fotos baixa qualidade */}
                    {lowQualityProducts.length > 0 && (
                      <div className="mt-8">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                            Produtos com Fotos de Baixa Qualidade
                          </h3>
                          <Button variant="outline" size="sm" disabled className="gap-2">
                            <Image className="w-4 h-4" />
                            Correção Automática (em breve)
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Fotos menores que 1200x1200px podem prejudicar a visibilidade dos seus anúncios.
                        </p>
                        {renderProductList(
                          lowQualityProducts,
                          "Todos os seus anúncios possuem fotos de alta qualidade (≥ 1200x1200px)",
                          (product) => `${product.photo_count} fotos • Menor dimensão: ${product.min_photo_dimension || 'N/A'}px`
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="individual" className="mt-6">
                    <HealthIndividual 
                      products={products}
                      selectedItemId={selectedItemId}
                      onSelectItem={setSelectedItemId}
                      itemHistory={itemHistory}
                    />
                  </TabsContent>
                </Tabs>
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
