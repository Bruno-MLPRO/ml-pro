import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { useMLAccounts } from "@/hooks/queries/useMLAccounts";
import { useMLAccountData, usePrefetchMLAccountsData } from "@/hooks/queries/useMLAccountData";
import { calculateShippingStats, calculateShippingStatsSimple } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Home, Image, Package, TrendingUp, DollarSign, ShoppingCart, Award, CheckCircle2, XCircle, AlertTriangle, ExternalLink, FileText, Receipt, MapPin, Truck, Warehouse, Megaphone, RefreshCw, Zap, Target, Eye, MousePointer, BarChart3, AlertCircle, Code, Loader2, PlugZap, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HealthDashboard } from "@/components/ml-health/HealthDashboard";
import { HealthIndividual } from "@/components/ml-health/HealthIndividual";
import { ProductAdsMetricCard } from "@/components/ProductAdsMetricCard";
import { SimpleProductsTable } from "@/components/SimpleProductsTable";
import { SalesComparisonChart } from "@/components/SalesComparisonChart";
import { TopPerformersCard } from "@/components/TopPerformersCard";
import { CampaignCard } from "@/components/CampaignCard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Interfaces removidas - usando tipos centralizados de @/types/mercadoLivre
import type { MLAccount, MLSellerRecovery, ItemHealth, Campaign, ProductAd, MLFullStock, MLProduct, HealthGoal } from "@/types/mercadoLivre";
import { formatCurrency } from "@/lib/formatters";

// MLMetrics local ainda necessário pois tem campos específicos diferentes do tipo centralizado
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
  has_recovery_benefit: boolean;
  recovery_program_type: string | null;
  recovery_program_status: string | null;
}

// ProductAd local estendido com campos adicionais específicos desta página
interface ProductAdExtended extends ProductAd {
  ml_item_id: string;
  title: string;
  thumbnail: string | null;
  is_recommended: boolean;
  price: number;
}

export default function MLAccountDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Hook para buscar contas ML - já retorna MLAccount com ml_nickname correto
  const { data: mlAccountsData = [], isLoading: loadingAccounts, refetch: refetchAccounts } = useMLAccounts();
  
  // Transformar para o formato esperado pelo componente (compatibilidade com interface local)
  const mlAccounts = mlAccountsData.map(acc => ({
    id: acc.id,
    ml_nickname: acc.ml_nickname || 'Sem nome',
    is_primary: acc.is_primary,
    is_active: acc.is_active,
    connected_at: acc.connected_at || '',
    last_sync_at: acc.last_sync_at,
    token_expires_at: acc.token_expires_at || '',
    has_product_ads_enabled: null,
    advertiser_id: null,
    has_active_campaigns: null,
    site_id: acc.site_id || ''
  }));
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"geral" | "anuncios" | "estoque" | "publicidade">("geral");
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [fullStock, setFullStock] = useState<MLFullStock[]>([]);
  const [sellerRecovery, setSellerRecovery] = useState<MLSellerRecovery | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Prefetch de dados das outras contas para troca rápida
  const accountIds = useMemo(() => mlAccounts.map(acc => acc.id), [mlAccounts]);
  usePrefetchMLAccountsData(accountIds, user?.id || null);
  const [adsFilter, setAdsFilter] = useState<'low_quality_photos' | 'no_description' | 'no_tax_data'>('low_quality_photos');
  const [shippingStats, setShippingStats] = useState<{
    flex: { count: number; percentage: number };
    agencies: { count: number; percentage: number };
    collection: { count: number; percentage: number };
    full: { count: number; percentage: number };
    correios: { count: number; percentage: number };
    envio_proprio: { count: number; percentage: number };
    total: number;
  } | null>(null);
  const [healthSubTab, setHealthSubTab] = useState<'dashboard' | 'individual'>('dashboard');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [healthHistory, setHealthHistory] = useState<any[]>([]);
  const [itemHistory, setItemHistory] = useState<any[]>([]);
  const [productAds, setProductAds] = useState<ProductAd[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [productAdsLoading, setProductAdsLoading] = useState(false);
  const [hasProductAds, setHasProductAds] = useState<boolean | null>(null);
  const [hasActiveCampaigns, setHasActiveCampaigns] = useState<boolean | null>(null);
  const [checkingProductAds, setCheckingProductAds] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Função auxiliar para verificar se a garantia está ativa
  const isGuaranteeActive = (): boolean => {
    // PRIORIDADE 1: Se has_decola está true nas métricas, considera ativo (calculado pelo ml-sync-data baseado em real_level + protection_end_date)
    if (metrics?.has_decola) return true;
    
    // PRIORIDADE 2: Se tem protection_end_date no futuro, considera ativo
    if (metrics?.protection_end_date) {
      const endDate = new Date(metrics.protection_end_date);
      const now = new Date();
      if (endDate > now) return true;
    }
    
    // PRIORIDADE 3: Se tem real_reputation_level, indica que Decola está ativo (protegendo a reputação)
    if (metrics?.real_reputation_level && metrics?.protection_end_date) {
      const endDate = new Date(metrics.protection_end_date);
      const now = new Date();
      if (endDate > now) return true;
    }
    
    // PRIORIDADE 4: Verificar sellerRecovery sincronizado (pode não estar sempre disponível)
    if (sellerRecovery) {
      // Status ACTIVE indica garantia ativa
      if (sellerRecovery.status === 'ACTIVE') return true;
      
      // Se guarantee_status é 'ON', está ativo
      if (sellerRecovery.guarantee_status === 'ON') return true;
      
      // Se tem end_date no futuro, ainda está ativo mesmo que status não seja ACTIVE
      if (sellerRecovery.end_date) {
        const endDate = new Date(sellerRecovery.end_date);
        const now = new Date();
        if (endDate > now) return true;
      }
      
      // Se está AVAILABLE e tem program_type com init_date, significa que foi ativado
      if (sellerRecovery.status === 'AVAILABLE' && sellerRecovery.program_type && sellerRecovery.init_date) {
        // Se tem end_date, verifica se ainda está válido
        if (sellerRecovery.end_date) {
          const endDate = new Date(sellerRecovery.end_date);
          const now = new Date();
          if (endDate > now) return true;
        } else {
          // Se não tem end_date mas tem init_date, pode estar ativo sem problemas ainda
          return true;
        }
      }
      
      // Se não está FINISHED ou UNAVAILABLE e tem program_type com init_date, existe programa ativo
      if (sellerRecovery.status !== 'FINISHED_BY_DATE' && 
          sellerRecovery.status !== 'FINISHED_BY_ISSUES' && 
          sellerRecovery.status !== 'FINISHED_BY_LEVEL' &&
          sellerRecovery.status !== 'FINISHED_BY_USER' &&
          sellerRecovery.status !== 'UNAVAILABLE' &&
          sellerRecovery.program_type &&
          sellerRecovery.init_date) {
        return true;
      }
    }
    
    return false;
  };

  useEffect(() => {
    if (mlAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(mlAccounts[0].id);
    }
  }, [mlAccounts]);

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
        refetchAccounts();
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

  // Hook para buscar dados completos da conta selecionada
  const { data: accountData, isLoading: loadingAccountData, isFetching: isFetchingAccountData, refetch: refetchAccountData } = useMLAccountData(selectedAccountId || null, user?.id || null);

  // Indicador de transição suave - mostra skeleton apenas se não tem dados em cache
  const isTransitioning = loadingAccountData && !accountData;

  useEffect(() => {
    if (accountData) {
      // Atualiza os dados imediatamente (pode ser cache)
      setMetrics(accountData.metrics);
      setProducts(accountData.products || []);
      setFullStock(accountData.stock || []);
      setSellerRecovery(accountData.sellerRecovery || null);
      
      // Calcular shipping stats
      if (accountData.products) {
        const stats = calculateShippingStats(accountData.products);
        setShippingStats(stats);
      } else {
        setShippingStats(null);
      }
      
      // Processar histórico de saúde
      if (accountData.history) {
        const historyByDate = new Map<string, number[]>();
        accountData.history.forEach(record => {
          const date = new Date(record.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          if (!historyByDate.has(date)) {
            historyByDate.set(date, []);
          }
          historyByDate.get(date)!.push(record.score / 100);
        });
        
        const aggregatedHistory = Array.from(historyByDate.entries()).map(([date, scores]) => ({
          date,
          averageScore: (scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100
        }));
        
        setHealthHistory(aggregatedHistory);
      }
      
      // Processar campanhas
      setCampaigns(accountData.campaigns || []);
      
      // Carregar Product Ads
      if (selectedAccountId) {
        loadProductAds(selectedAccountId);
      }
      
      // Verify Product Ads status if not yet checked
      const account = mlAccounts.find(acc => acc.id === selectedAccountId);
      if (account && (account.has_product_ads_enabled === null || account.has_product_ads_enabled === false)) {
        verifyProductAdsStatus(selectedAccountId);
      }
    }
  }, [accountData, selectedAccountId, mlAccounts]);

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
        refetchAccountData();
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
        refetchAccountData();
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
        refetchAccountData();
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
        
        refetchAccountData();
      })
      .subscribe();

    const productAdsChannel = supabase
      .channel('ml-product-ads-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mercado_livre_product_ads',
        filter: `ml_account_id=eq.${selectedAccountId}`
      }, () => {
        loadProductAds(selectedAccountId);
      })
      .subscribe();

    return () => {
      metricsChannel.unsubscribe();
      productsChannel.unsubscribe();
      stockChannel.unsubscribe();
      healthChannel.unsubscribe();
      productAdsChannel.unsubscribe();
    };
  }, [selectedAccountId]);



  const loadProductAds = async (accountId: string) => {
    try {
      // Load campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('mercado_livre_campaigns')
        .select('*')
        .eq('ml_account_id', accountId)
        .order('total_spend', { ascending: false });

      if (campaignsError) {
        console.error('Error loading campaigns:', campaignsError);
        throw campaignsError;
      }
      
      setCampaigns(campaignsData || []);

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('mercado_livre_product_ads')
        .select('*')
        .eq('ml_account_id', accountId)
        .order('is_recommended', { ascending: false })
        .order('created_at', { ascending: false });

      if (productsError) {
        console.error('Error loading products:', productsError);
        throw productsError;
      }
      
      setProductAds(productsData || []);
      
      // Check if user has product ads enabled and active campaigns
      const { data: accountData } = await supabase
        .from('mercado_livre_accounts')
        .select('has_product_ads_enabled, has_active_campaigns')
        .eq('id', accountId)
        .maybeSingle();

      setHasProductAds(accountData?.has_product_ads_enabled || false);
      setHasActiveCampaigns(accountData?.has_active_campaigns);
    } catch (error: any) {
      console.error('Error loading product ads:', error);
      setProductAds([]);
      setCampaigns([]);
      setHasProductAds(null);
      setHasActiveCampaigns(null);
    }
  };


  const verifyProductAdsStatus = async (accountId: string) => {
    setCheckingProductAds(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-check-product-ads-status', {
        body: { ml_account_id: accountId }
      });

      if (error) {
        console.error('Error checking Product Ads status:', error);
        return;
      }

      setHasProductAds(data.enabled);
      
      // If enabled, load the data automatically
      if (data.enabled) {
        await loadProductAds(accountId);
      }
    } catch (error) {
      console.error('Error verifying Product Ads:', error);
    } finally {
      setCheckingProductAds(false);
    }
  };

  const syncProductAds = async () => {
    setProductAdsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ml-get-product-ads-data', {
        body: { ml_account_id: selectedAccountId }
      });

      if (error) {
        toast.error('Erro ao sincronizar', {
          description: error.message
        });
        return;
      }

      if (data.has_product_ads === false) {
        setHasProductAds(false);
        setHasActiveCampaigns(null);
        toast.warning('Product Ads não habilitado', {
          description: 'Esta conta ainda não tem acesso ao Product Ads do Mercado Livre'
        });
        return;
      }

      setHasProductAds(true);
      setHasActiveCampaigns(data.has_active_campaigns);
      
      if (data.has_active_campaigns === false) {
        toast.warning('⚠️ Sem Campanhas Ativas', {
          description: 'Product Ads está habilitado, mas você não tem campanhas ativas no momento'
        });
      } else {
        toast.success('✅ Dados Sincronizados!', {
          description: `${data.items_synced} anúncios atualizados. ${data.in_campaigns || 0} em campanhas.`
        });
      }

      await loadProductAds(selectedAccountId);
    } catch (error: any) {
      toast.error('Erro ao sincronizar', {
        description: error.message || 'Erro desconhecido'
      });
    } finally {
      setProductAdsLoading(false);
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

  const testConnection = async (accountId: string) => {
    if (!accountId) return;
    setTestingConnection(true);
    
    const toastId = toast.loading('Testando conexão...', {
      description: `Verificando token para a conta selecionada.`,
    });

    try {
      const { data, error } = await supabase.functions.invoke('ml-test-connection', {
        body: { ml_account_id: accountId }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        toast.success('Conexão bem-sucedida!', {
          id: toastId,
          description: `O token de acesso para ${data.nickname} é válido.`,
        });
      } else {
        toast.error('Falha na conexão', {
          id: toastId,
          description: data.message || 'O token de acesso é inválido ou expirou.',
        });
      }
    } catch (error: any) {
      toast.error('Erro no teste de conexão', {
        id: toastId,
        description: error.message || 'Ocorreu um erro desconhecido.',
      });
    } finally {
      setTestingConnection(false);
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
            
            <div className="flex items-center gap-2">
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId} disabled={isFetchingAccountData}>
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
              
              {/* Indicador sutil de carregamento ao trocar de conta */}
              {isFetchingAccountData && !isTransitioning && (
                <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => testConnection(selectedAccountId)}
                    disabled={testingConnection || !selectedAccountId}
                  >
                    <PlugZap className={`w-4 h-4 ${testingConnection ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Testar Conexão com Mercado Livre</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
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
              <TabsTrigger value="publicidade">
                <Megaphone className="w-4 h-4 mr-2" />
                Publicidade
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

                  {/* Garantia de Reputação */}
                  {isGuaranteeActive() && (
                    <Card className="bg-muted/50">
                      <CardContent className="pt-4">
                        <div className="space-y-4">
                          {/* Header */}
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="font-medium text-sm mb-1">
                                Garantia de Reputação Ativa
                                {sellerRecovery.program_type === 'NEWBIE_GRNTEE' && ' (Programa Decola)'}
                                {sellerRecovery.program_type === 'RECOVERY_GRNTEE' && ' (Benefício de Reputação)'}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Sua reputação está sendo protegida.
                              </p>
                            </div>
                          </div>

                          {/* Reputação Real */}
                          {(metrics?.real_reputation_level || sellerRecovery?.current_level) && (
                            <div className="pl-8">
                              <p className="text-xs text-muted-foreground mb-2">Reputação Real:</p>
                              <ReputationBadge
                                color={(() => {
                                  // PRIORIDADE: real_reputation_level (da API /users/$USER_ID) > current_level (da API seller recovery)
                                  // real_level vem como "red", "orange", "yellow", "light_green", "green"
                                  // current_level pode vir como "newbie", "1_red", "2_orange", "3_yellow", "4_light_green", "5_green"
                                  const level = metrics?.real_reputation_level || sellerRecovery?.current_level || 'gray';
                                  
                                  if (!level || level === 'newbie') return 'gray';
                                  
                                  // Formato simples (da API /users/$USER_ID): "red", "orange", "yellow", "light_green", "green"
                                  if (level === 'red') return 'red';
                                  if (level === 'orange') return 'orange';
                                  if (level === 'yellow') return 'yellow';
                                  if (level === 'light_green') return 'light_green';
                                  if (level === 'green') return 'dark_green'; // green = verde escuro (5_green)
                                  
                                  // Formato com prefixo (da API seller recovery): "1_red", "2_orange", "3_yellow", "4_light_green", "5_green"
                                  if (level.includes('green') && (level.startsWith('5') || level === 'green')) return 'dark_green';
                                  if (level.includes('light_green') || level.includes('green')) return 'light_green';
                                  if (level.includes('yellow')) return 'yellow';
                                  if (level.includes('orange')) return 'orange';
                                  if (level.includes('red')) return 'red';
                                  
                                  return 'gray';
                                })()}
                                levelId={metrics?.real_reputation_level || sellerRecovery?.current_level || null}
                                positiveRate={metrics?.positive_ratings_rate || 0}
                                totalTransactions={metrics?.reputation_transactions_total || 0}
                              />
                              {/* Exibir Power Seller Status se disponível */}
                              {metrics?.is_mercado_lider && metrics?.mercado_lider_level && (
                                <div className="mt-2 flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs">
                                    👑 Power Seller: {metrics.mercado_lider_level === 'platinum' ? 'Platinum' : 
                                                       metrics.mercado_lider_level === 'gold' ? 'Gold' : 
                                                       metrics.mercado_lider_level === 'silver' ? 'Silver' : 
                                                       metrics.mercado_lider_level === 'bronze' ? 'Bronze' : 
                                                       metrics.mercado_lider_level}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Contador de Problemas */}
                          {(sellerRecovery || metrics?.has_decola || metrics?.decola_problems_count !== undefined) && (
                            <div className="space-y-2 pl-8">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Problemas</span>
                                <span className={`text-sm font-bold ${
                                  (() => {
                                    // Se Decola está ativo, calcular problemas das métricas REAIS primeiro
                                    if (metrics?.has_decola) {
                                      const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                      if (problemsFromMetrics >= 4) return 'text-red-500';
                                      if (problemsFromMetrics >= 3) return 'text-orange-500';
                                      return 'text-green-500';
                                    }
                                    // Se tem sellerRecovery, usar seus valores
                                    if (sellerRecovery) {
                                      const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                      const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                      if (totalIssues >= maxIssues - 1) return 'text-red-500';
                                      if (totalIssues >= maxIssues - 2) return 'text-orange-500';
                                      return 'text-green-500';
                                    }
                                    // Fallback para decola_problems_count
                                    const problems = metrics.decola_problems_count ?? 0;
                                    if (problems >= 4) return 'text-red-500';
                                    if (problems >= 3) return 'text-orange-500';
                                    return 'text-green-500';
                                  })()
                                }`}>
                                  {(() => {
                                    // PRIORIDADE 1: Se Decola está ativo, calcular das métricas REAIS
                                    if (metrics?.has_decola) {
                                      const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                      const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                      return `${problemsFromMetrics}/${maxIssues}`;
                                    }
                                    // PRIORIDADE 2: Se tem sellerRecovery, usar seus valores
                                    if (sellerRecovery) {
                                      const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                      const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                      return `${totalIssues}/${maxIssues}`;
                                    }
                                    // PRIORIDADE 3: Fallback para decola_problems_count
                                    return `${metrics.decola_problems_count ?? 0}/5`;
                                  })()}
                                </span>
                              </div>
                              
                              <Progress 
                                value={(() => {
                                  // PRIORIDADE 1: Se Decola está ativo, calcular das métricas REAIS
                                  if (metrics?.has_decola) {
                                    const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                    const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                    return (problemsFromMetrics / maxIssues) * 100;
                                  }
                                  // PRIORIDADE 2: Se tem sellerRecovery, usar seus valores
                                  if (sellerRecovery) {
                                    const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                    const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                    return (totalIssues / maxIssues) * 100;
                                  }
                                  // PRIORIDADE 3: Fallback
                                  return ((metrics.decola_problems_count ?? 0) / 5) * 100;
                                })()} 
                                className={`h-2 ${
                                  (() => {
                                    // PRIORIDADE 1: Se Decola está ativo, calcular das métricas REAIS
                                    if (metrics?.has_decola) {
                                      const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                      if (problemsFromMetrics >= 4) return '[&>div]:bg-red-500';
                                      if (problemsFromMetrics >= 3) return '[&>div]:bg-orange-500';
                                      return '[&>div]:bg-green-500';
                                    }
                                    // PRIORIDADE 2: Se tem sellerRecovery, usar seus valores
                                    if (sellerRecovery) {
                                      const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                      const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                      if (totalIssues >= maxIssues - 1) return '[&>div]:bg-red-500';
                                      if (totalIssues >= maxIssues - 2) return '[&>div]:bg-orange-500';
                                      return '[&>div]:bg-green-500';
                                    }
                                    // PRIORIDADE 3: Fallback
                                    const problems = metrics.decola_problems_count ?? 0;
                                    if (problems >= 4) return '[&>div]:bg-red-500';
                                    if (problems >= 3) return '[&>div]:bg-orange-500';
                                    return '[&>div]:bg-green-500';
                                  })()
                                }`}
                              />
                              
                              {(() => {
                                // PRIORIDADE 1: Se Decola está ativo, calcular das métricas REAIS
                                if (metrics?.has_decola) {
                                  const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                  const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                  return problemsFromMetrics >= maxIssues - 1;
                                }
                                // PRIORIDADE 2: Se tem sellerRecovery
                                if (sellerRecovery) {
                                  const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                  const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                  return totalIssues >= maxIssues - 1;
                                }
                                // PRIORIDADE 3: Fallback
                                return (metrics.decola_problems_count ?? 0) >= 4;
                              })() && (
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Atenção! Você está próximo do limite de problemas.
                                </p>
                              )}
                              
                              <p className="text-xs text-muted-foreground">
                                Ao atingir {(sellerRecovery?.max_issues_allowed ?? 5)} problemas (reclamações + atrasos + cancelamentos), 
                                a Garantia de Reputação será encerrada e sua reputação real será exibida.
                              </p>
                            </div>
                          )}

                          {/* Válido até */}
                          {(sellerRecovery?.end_date || metrics?.protection_end_date) && (
                            <div className="pl-8 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Válido até:</p>
                              <p className="text-sm font-medium">
                                {new Date(sellerRecovery?.end_date || metrics.protection_end_date || '').toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          )}

                          {/* Valor de garantia */}
                          {sellerRecovery?.guarantee_price && (
                            <div className="pl-8 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Valor de garantia:</p>
                              <p className="text-sm font-medium">
                                {formatCurrency(sellerRecovery.guarantee_price)}
                              </p>
                            </div>
                          )}

                          {/* Valor de bonus em ADS */}
                          {sellerRecovery?.advertising_amount && (
                            <div className="pl-8 pt-2 border-t">
                              <p className="text-xs text-muted-foreground mb-1">Valor de bonus em ADS:</p>
                              <p className="text-sm font-medium">
                                {formatCurrency(sellerRecovery.advertising_amount)}
                              </p>
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
                          variant={isGuaranteeActive() ? "default" : "outline"}
                          className="ml-auto"
                        >
                          {isGuaranteeActive() ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          Garantia {isGuaranteeActive() ? "Ativa" : "Inativa"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <ReputationBadge
                          color={metrics.reputation_color}
                          levelId={metrics.reputation_level}
                          positiveRate={metrics.positive_ratings_rate}
                          totalTransactions={metrics.reputation_transactions_total}
                        />
                        {/* Exibir Power Seller Status */}
                        {metrics.is_mercado_lider && metrics.mercado_lider_level && (
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Badge variant="outline" className="text-xs font-semibold">
                              👑 Power Seller: {metrics.mercado_lider_level === 'platinum' ? 'Platinum' : 
                                                 metrics.mercado_lider_level === 'gold' ? 'Gold' : 
                                                 metrics.mercado_lider_level === 'silver' ? 'Silver' : 
                                                 metrics.mercado_lider_level === 'bronze' ? 'Bronze' : 
                                                 metrics.mercado_lider_level}
                            </Badge>
                          </div>
                        )}
                      </div>
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
                    <Card className="mt-6 border border-border hover:shadow-lg transition-shadow duration-300">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-primary" />
                          Tipos de Envio
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Distribuição de anúncios por modalidade de envio Mercado Livre
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-5">
                          {/* Correios */}
                          {shippingStats.correios.count > 0 ? (
                            <div className="p-5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-5 h-5 text-cyan-400" />
                                  <span className="font-semibold text-sm">Correios</span>
                                </div>
                                <Badge className="bg-cyan-500 text-xs">
                                  {shippingStats.correios.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.correios.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.correios.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">Correios</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}

                          {/* FLEX */}
                          {shippingStats.flex.count > 0 ? (
                            <div className="p-5 rounded-lg border border-blue-500/50 bg-blue-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Package className="w-5 h-5 text-blue-400" />
                                  <span className="font-semibold text-sm">FLEX</span>
                                </div>
                                <Badge className="bg-blue-500 text-xs">
                                  {shippingStats.flex.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.flex.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.flex.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">FLEX</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}

                          {/* Agências */}
                          {shippingStats.agencies.count > 0 ? (
                            <div className="p-5 rounded-lg border border-purple-500/50 bg-purple-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-5 h-5 text-purple-400" />
                                  <span className="font-semibold text-sm">Agências</span>
                                </div>
                                <Badge className="bg-purple-500 text-xs">
                                  {shippingStats.agencies.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.agencies.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.agencies.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">Agências</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}

                          {/* Coleta */}
                          {shippingStats.collection.count > 0 ? (
                            <div className="p-5 rounded-lg border border-green-500/50 bg-green-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Truck className="w-5 h-5 text-green-400" />
                                  <span className="font-semibold text-sm">Coleta</span>
                                </div>
                                <Badge className="bg-green-500 text-xs">
                                  {shippingStats.collection.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.collection.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.collection.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Truck className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">Coleta</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}

                          {/* FULL */}
                          {shippingStats.full.count > 0 ? (
                            <div className="p-5 rounded-lg border border-orange-500/50 bg-orange-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="w-5 h-5 text-orange-400" />
                                  <span className="font-semibold text-sm">FULL</span>
                                </div>
                                <Badge className="bg-orange-500 text-xs">
                                  {shippingStats.full.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.full.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.full.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Warehouse className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">FULL</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}

                          {/* Envio Próprio */}
                          {shippingStats.envio_proprio.count > 0 ? (
                            <div className="p-5 rounded-lg border border-indigo-500/50 bg-indigo-500/10 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Send className="w-5 h-5 text-indigo-400" />
                                  <span className="font-semibold text-sm">Envio Próprio</span>
                                </div>
                                <Badge className="bg-indigo-500 text-xs">
                                  {shippingStats.envio_proprio.count}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress value={shippingStats.envio_proprio.percentage} className="h-2 flex-1" />
                                <span className="text-xs font-medium">{shippingStats.envio_proprio.percentage.toFixed(0)}%</span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-5 rounded-lg border border-border/50 bg-muted/30 min-h-[110px] flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Send className="w-5 h-5 text-muted-foreground" />
                                  <span className="font-semibold text-sm text-muted-foreground">Envio Próprio</span>
                                </div>
                                <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                              </div>
                              <div className="h-2"></div>
                            </div>
                          )}
                        </div>
                        
                        {/* Resumo */}
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-muted-foreground">
                            Total de anúncios ativos: <span className="font-semibold text-foreground">{shippingStats.total}</span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
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
                      <div className="grid md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Unidades Disponíveis</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {fullStock.reduce((sum, item) => sum + item.available_units, 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Faturamento Previsto</p>
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {fullStock.reduce((sum, item) => {
                              const price = item.mercado_livre_products?.price || 0;
                              return sum + (item.available_units * price);
                            }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Payout Previsto</p>
                          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                            {fullStock.reduce((sum, item) => {
                              const price = item.mercado_livre_products?.price || 0;
                              const revenue = item.available_units * price;
                              const payout = revenue * (1 - 0.22); // 22% taxas (14% ML + 8% frete)
                              return sum + payout;
                            }, 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Total de Unidades no Estoque FULL</span>
                          <span className="font-medium">{fullStock.reduce((sum, item) => sum + item.available_units, 0)} unidades</span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lista de Produtos no FULL */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Produtos no Estoque FULL</h3>
                    <div className="space-y-2">
                      {fullStock.map((item) => {
                        const price = item.mercado_livre_products?.price || 0;
                        const revenue = item.available_units * price;
                        const payout = revenue * (1 - 0.22); // 22% taxas (14% ML + 8% frete)
                        
                        return (
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
                                  <p className="text-sm text-muted-foreground mb-3">
                                    {item.ml_item_id} • Inventário: {item.inventory_id}
                                  </p>
                                  
                                  <div className="flex flex-wrap gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Quantidade Disponível</p>
                                      <p className="text-green-600 dark:text-green-400 font-bold">{item.available_units} unidades</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-1">Preço Unitário</p>
                                      <p className="font-bold">
                                        {price > 0 
                                          ? price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) 
                                          : 'Não disponível'}
                                      </p>
                                    </div>
                                    {price > 0 && (
                                      <>
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Faturamento Previsto</p>
                                          <p className="text-blue-600 dark:text-blue-400 font-bold">
                                            {revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-muted-foreground text-xs mb-1">Payout Previsto</p>
                                          <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                                            {payout.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                          </p>
                                        </div>
                                      </>
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
                        );
                      })}
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

            {/* ABA PUBLICIDADE */}
            <TabsContent value="publicidade" className="space-y-6">
              {!hasProductAds ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Product Ads não habilitado</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">Esta conta ainda não tem acesso ao Product Ads do Mercado Livre.</p>
                    <p className="text-sm">Para habilitar, acesse o painel do Mercado Livre e ative o Product Ads.</p>
                  </AlertDescription>
                </Alert>
              ) : hasActiveCampaigns === false ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Sem Campanhas Ativas</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">Product Ads está habilitado, mas você não tem campanhas ativas no momento.</p>
                    <p className="text-sm">Crie campanhas no painel do Mercado Livre para começar a anunciar seus produtos.</p>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex justify-end">
                    <Button onClick={syncProductAds} disabled={productAdsLoading} variant="outline" size="sm">
                      <RefreshCw className={`w-4 h-4 mr-2 ${productAdsLoading ? 'animate-spin' : ''}`} />
                      Sincronizar Dados
                    </Button>
                  </div>

                  {/* Métricas Gerais */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <ProductAdsMetricCard
                      title="Investimento Total"
                      value={`R$ ${campaigns.reduce((sum, c) => sum + c.total_spend, 0).toFixed(2)}`}
                      subtitle="Últimos 30 dias"
                      icon={DollarSign}
                      gradient="bg-gradient-to-br from-orange-500 to-red-500"
                    />
                    <ProductAdsMetricCard
                      title="Receita com Ads"
                      value={`R$ ${campaigns.reduce((sum, c) => sum + c.ad_revenue, 0).toFixed(2)}`}
                      subtitle={`${campaigns.reduce((sum, c) => sum + c.advertised_sales, 0)} vendas`}
                      icon={TrendingUp}
                      gradient="bg-gradient-to-br from-green-500 to-cyan-500"
                    />
                    <ProductAdsMetricCard
                      title="Receita Orgânica"
                      value={`R$ ${campaigns.reduce((sum, c) => sum + c.organic_revenue, 0).toFixed(2)}`}
                      subtitle={`${campaigns.reduce((sum, c) => sum + c.organic_sales, 0)} vendas`}
                      icon={BarChart3}
                      gradient="bg-gradient-to-br from-purple-500 to-pink-500"
                    />
                    <ProductAdsMetricCard
                      title="ROAS Médio"
                      value={(() => {
                        const totalSpend = campaigns.reduce((sum, c) => sum + c.total_spend, 0);
                        const totalRevenue = campaigns.reduce((sum, c) => sum + c.ad_revenue, 0);
                        return totalSpend > 0 ? `${(totalRevenue / totalSpend).toFixed(2)}x` : 'N/A';
                      })()}
                      subtitle="Retorno sobre investimento"
                      icon={Target}
                      gradient="bg-gradient-to-br from-blue-500 to-indigo-500"
                    />
                  </div>

                  {/* Campanhas Ativas */}
                  {campaigns.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Megaphone className="h-5 w-5" />
                          Campanhas Ativas ({campaigns.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {campaigns.map(campaign => (
                            <CampaignCard key={campaign.id} campaign={campaign} />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Produtos Recomendados */}
                  {productAds.filter(p => p.is_recommended).length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="space-y-1">
                          <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 w-5 text-yellow-500" />
                            Produtos Recomendados pelo Mercado Livre
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Estes produtos têm alto potencial para campanhas de publicidade
                          </p>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <SimpleProductsTable items={productAds.filter(p => p.is_recommended)} />
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
