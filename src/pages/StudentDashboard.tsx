import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Calendar, Link as LinkIcon, TrendingUp, DollarSign, Package, CheckCircle2, ShoppingBag, Plus, Unplug, Star, Crown, Circle, ExternalLink, ShoppingCart, MapPin, Truck, Warehouse, Target, Mail, Send } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ReputationBadge } from '@/components/ReputationBadge';
import { useMLAccounts, useSyncMLAccount } from '@/hooks/queries/useMLAccounts';
import { useStudentMetrics, useStudentMonthlyMetrics } from '@/hooks/queries/useMLMetrics';
import { useMLOrders } from '@/hooks/queries/useMLOrders';
import { useProductAdsMetrics } from '@/hooks/queries/useConsolidatedMetrics';
import { useShippingStats } from '@/hooks/queries/useShippingStats';
import { useDashboardData } from '@/hooks/useDashboardData';
import { formatCurrency, formatDescription } from '@/lib/formatters';
import type { MLAccount, MLMetrics } from '@/types/mercadoLivre';
import type { ShippingStats, ProductAdsMetrics } from '@/types/metrics';

// Interfaces removidas - usando tipos centralizados de @/types/common e @/types/mercadoLivre

// Interfaces MLMetrics, ShippingStats e ProductAdsMetrics removidas - usando tipos centralizados

const StudentDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30>(30);
  const [connectingML, setConnectingML] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // ✅ Hook consolidado para dados do dashboard (avisos, links, agendamentos)
  const {
    notices,
    importantLinks,
    callSchedules,
    loading,
    refetch: refetchDashboardData
  } = useDashboardData(user?.id, userRole);
  
  // Hooks com React Query
  const { data: mlAccounts = [], isLoading: loadingAccounts, refetch: refetchAccounts } = useMLAccounts();
  const { data: studentMetrics, isLoading: loadingMetrics } = useStudentMetrics(user?.id || null, selectedPeriod);
  const { data: ordersData } = useMLOrders(user?.id || null, selectedPeriod);
  const { data: monthlyHistory = [] } = useStudentMonthlyMetrics(user?.id || null);
  const syncMLAccountMutation = useSyncMLAccount();
  
  // Calcular métricas de Product Ads
  const accountIds = mlAccounts.map(acc => acc.id);
  const { data: productAdsMetrics } = useProductAdsMetrics(accountIds);
  
  // Calcular shipping stats dos produtos ativos - usando React Query para cache
  const { data: shippingStats } = useShippingStats(user?.id || null, accountIds);

  // Tratar parâmetros de retorno do OAuth do ML
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mlError = urlParams.get('ml_error');
    const mlConnected = urlParams.get('ml_connected');
    const nickname = urlParams.get('nickname');
    const mlAlreadyProcessed = urlParams.get('ml_already_processed');

    if (mlError) {
      // Detectar erro de callback URL não autorizada
      if (mlError.includes('callback') || mlError.includes('requested path')) {
        toast({
          title: "URL de Callback não autorizada",
          description: "Configure https://tmacddkgqaducwdfubft.supabase.co/functions/v1/ml-oauth-callback nas URLs de Redirecionamento do seu app ML.",
          variant: "destructive",
          duration: 10000,
        });
      } else {
        toast({
          title: "Erro ao conectar Mercado Livre",
          description: decodeURIComponent(mlError),
          variant: "destructive",
        });
      }
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', '/aluno/dashboard');
    }

    if (mlAlreadyProcessed === 'true') {
      toast({
        title: "Já processado",
        description: "Esta autorização já foi processada anteriormente.",
        variant: "default",
      });
      window.history.replaceState({}, '', '/aluno/dashboard');
    }

    if (mlConnected === 'true') {
      const accountName = nickname ? decodeURIComponent(nickname) : 'Sua conta';
      toast({
        title: "✅ Conta conectada!",
        description: `${accountName} do Mercado Livre foi conectada. Sincronizando dados...`,
        duration: 5000,
      });
      
      // Limpar parâmetros da URL
      window.history.replaceState({}, '', '/aluno/dashboard');
      
      // Recarregar dados imediatamente
      if (user) {
        refetchAccounts();
        // Auto-refresh após 2 segundos para garantir que os dados foram salvos
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      // ✅ Dados do dashboard são carregados automaticamente pelo hook useDashboardData
      
      // Configurar realtime completo para todas as tabelas ML
      const channel = supabase
        .channel('student-dashboard-realtime')
        
        // Listener 1: Métricas ML
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_metrics',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('ML metrics updated');
            refetchAccounts();
          }
        )
        
        // Listener 2: Contas ML
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_accounts',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('ML accounts updated');
            refetchAccounts();
          }
        )
        
        // Listener 3: Pedidos (novas vendas!)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'mercado_livre_orders',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('New order received!');
            toast({
              title: "Nova venda! 🎉",
              description: "Sua conta Mercado Livre recebeu um novo pedido.",
            });
            refetchAccounts();
          }
        )
        
        // Listener 4: Produtos
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_products',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('Product updated');
            refetchAccounts();
          }
        )
        
        // Listener 5: Estoque FULL
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_full_stock',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('FULL stock updated');
            refetchAccounts();
          }
        )
        
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, userRole, authLoading, navigate, refetchAccounts, toast]);

  const testMLConnection = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ml-test-connection');
      
      if (error) {
        console.error('Test error:', error);
        toast({
          title: "Erro ao testar conexão",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('ML Connection Test:', data);
      
      if (!data.app_id_configured || !data.secret_key_configured) {
        toast({
          title: "Configuração incompleta",
          description: "As credenciais do Mercado Livre não estão configuradas corretamente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Configuração OK",
          description: `APP_ID: ${data.app_id_preview}\nCallback: ${data.callback_url}`,
        });
      }
    } catch (error) {
      console.error('Test error:', error);
    }
  };

  const handleConnectML = async () => {
    setConnectingML(true);
    toast({
      title: "Redirecionando...",
      description: "Você será redirecionado para o Mercado Livre para autorizar a conexão.",
    });
    
    try {
      const { data, error } = await supabase.functions.invoke('ml-auth-start');
      
      if (error) {
        console.error('Error starting ML auth:', error);
        toast({
          title: "Erro ao iniciar conexão",
          description: "Não foi possível iniciar o processo de conexão. Tente novamente.",
          variant: "destructive",
        });
        setConnectingML(false);
        return;
      }

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error('No authorization URL received');
      }
    } catch (error) {
      console.error('Error in handleConnectML:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao conectar com o Mercado Livre.",
        variant: "destructive",
      });
      setConnectingML(false);
    }
  }

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Tem certeza que deseja desconectar esta conta?')) return
    
    try {
      await supabase.functions.invoke('ml-disconnect-account', {
        body: { ml_account_id: accountId }
      })
      
      refetchAccounts();
    } catch (error) {
      console.error('Error disconnecting ML account:', error)
      toast({
        title: "Erro ao desconectar",
        description: "Não foi possível desconectar a conta.",
        variant: "destructive",
      });
    }
  }

  const handleSetPrimaryAccount = async (accountId: string) => {
    try {
      // Primeiro, desmarcar todas as contas como não-primárias
      const { error: updateError } = await supabase
        .from('mercado_livre_accounts')
        .update({ is_primary: false })
        .eq('student_id', user?.id);

      if (updateError) throw updateError;

      // Depois, marcar a conta selecionada como primária
      const { error: setPrimaryError } = await supabase
        .from('mercado_livre_accounts')
        .update({ is_primary: true })
        .eq('id', accountId);

      if (setPrimaryError) throw setPrimaryError;

      toast({
        title: "Conta principal atualizada",
        description: "Esta conta foi definida como sua conta principal.",
      });

      refetchAccounts();
    } catch (error) {
      console.error('Error setting primary account:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a conta principal.",
        variant: "destructive",
      });
    }
  };

  const handleSyncAccount = async (accountId: string) => {
    try {
      toast({
        title: "Sincronizando...",
        description: "Buscando dados do Mercado Livre. Isso pode levar alguns segundos.",
      });

      await syncMLAccountMutation.mutateAsync(accountId);

      toast({
        title: "Sincronização concluída",
        description: "Os dados foram atualizados com sucesso.",
      });
    } catch (error) {
      console.error('Error syncing account:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os dados. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  // Métricas consolidadas a partir dos hooks
  const consolidatedMetrics = mlAccounts.length > 0 && studentMetrics ? {
    total_sales: studentMetrics.totalSales,
    total_revenue: studentMetrics.totalRevenue,
    average_ticket: studentMetrics.averageTicket,
    active_listings: mlAccounts[0]?.metrics?.active_listings || 0,
    reputation_level: mlAccounts[0]?.metrics?.reputation_level || null,
    reputation_color: mlAccounts[0]?.metrics?.reputation_color || 'gray',
    reputation_transactions_total: mlAccounts[0]?.metrics?.reputation_transactions_total || 0,
    positive_ratings_rate: mlAccounts[0]?.metrics?.positive_ratings_rate || 0,
    has_decola: mlAccounts[0]?.metrics?.has_decola || false,
    has_full: mlAccounts[0]?.metrics?.has_full || false,
    is_mercado_lider: mlAccounts[0]?.metrics?.is_mercado_lider || false,
    mercado_lider_level: mlAccounts[0]?.metrics?.mercado_lider_level || null
  } : null;
  
  const orderCount = ordersData?.totalCount || null;

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-4xl font-display font-bold text-foreground mb-2">
            Dashboard
          </h1>
          <p className="text-foreground-secondary mb-8">
            Bem-vindo ao seu painel de controle
          </p>

          {/* Dashboard de Vendas */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle>Desempenho</CardTitle>
                </div>
                {mlAccounts.length > 1 && (
                  <Badge variant="outline">
                    {mlAccounts.length} contas consolidadas
                  </Badge>
                )}
              </div>
              <CardDescription>
                {mlAccounts.length === 0 
                  ? 'Conecte uma conta do Mercado Livre para visualizar suas métricas'
                  : `Últimos ${selectedPeriod} dias a partir de hoje - ${format(new Date(Date.now() - selectedPeriod * 24 * 60 * 60 * 1000), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filtros de Período */}
              {mlAccounts.length > 0 && (
                <div className="flex gap-2 mb-6">
                  <Button
                    size="sm"
                    variant={selectedPeriod === 7 ? "default" : "outline"}
                    onClick={() => setSelectedPeriod(7)}
                  >
                    Últimos 7 dias
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPeriod === 15 ? "default" : "outline"}
                    onClick={() => setSelectedPeriod(15)}
                  >
                    Últimos 15 dias
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPeriod === 30 ? "default" : "outline"}
                    onClick={() => setSelectedPeriod(30)}
                  >
                    Últimos 30 dias
                  </Button>
                </div>
              )}
              {mlAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-foreground-secondary">
                    Conecte uma conta do Mercado Livre para visualizar suas métricas
                  </p>
                </div>
              ) : loadingMetrics ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Atualizando métricas...</span>
                </div>
              ) : (
                <>
                  {/* Métricas Principais */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-success" />
                        <span className="text-sm text-foreground-secondary">Faturamento</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {formatCurrency(consolidatedMetrics?.total_revenue || 0)}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Últimos {selectedPeriod} dias
                      </p>
                    </div>
                    
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart className="w-5 h-5 text-primary" />
                        <span className="text-sm text-foreground-secondary">Número de vendas</span>
                        {orderCount && orderCount > (consolidatedMetrics?.total_sales || 0) && (
                          <Badge variant="destructive" className="text-xs">
                            Limitado
                          </Badge>
                        )}
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {consolidatedMetrics?.total_sales || 0}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Últimos {selectedPeriod} dias
                      </p>
                      {orderCount && orderCount > (consolidatedMetrics?.total_sales || 0) && (
                        <p className="text-xs text-destructive mt-1 font-semibold">
                          ⚠️ Mostrando {(consolidatedMetrics?.total_sales || 0).toLocaleString('pt-BR')} de {orderCount.toLocaleString('pt-BR')} pedidos
                        </p>
                      )}
                    </div>
                    
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-warning" />
                        <span className="text-sm text-foreground-secondary">Ticket Médio</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {formatCurrency(consolidatedMetrics?.average_ticket || 0)}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Últimos {selectedPeriod} dias
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Card Product Ads */}
          {mlAccounts.length > 0 && productAdsMetrics && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-accent" />
                  <CardTitle>Product Ads</CardTitle>
                </div>
                <CardDescription>
                  Métricas de anúncios - Últimos {selectedPeriod} dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Investido */}
                  <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-5 h-5 text-orange-400" />
                      <span className="text-sm font-medium">Total Investido</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(productAdsMetrics.totalSpend)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Investimento em anúncios
                    </p>
                  </div>
                  
                  {/* Receita com Ads */}
                  <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                      <span className="text-sm font-medium">Receita com Ads</span>
                    </div>
                    <p className="text-2xl font-bold">{formatCurrency(productAdsMetrics.totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {productAdsMetrics.totalSales} vendas
                    </p>
                  </div>
                  
                  {/* ROAS */}
                  <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium">ROAS</span>
                    </div>
                    <p className="text-2xl font-bold">{productAdsMetrics.roas.toFixed(2)}x</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Retorno sobre investimento
                    </p>
                  </div>
                  
                  {/* ACOS */}
                  <div className="p-4 rounded-lg border border-purple-500/50 bg-purple-500/10">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-5 h-5 text-purple-400" />
                      <span className="text-sm font-medium">ACOS</span>
                    </div>
                    <p className="text-2xl font-bold">{productAdsMetrics.acos.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Custo de aquisição
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Badges de Tipo de Envio */}
          {shippingStats && (
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <CardTitle>Tipos de Envio</CardTitle>
                </div>
                <CardDescription>
                  Distribuição de anúncios por modalidade de envio Mercado Livre
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-5">
                  {/* Correios Badge */}
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

                  {/* FLEX Badge */}
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

                  {/* Agências Badge */}
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

                  {/* Coleta Badge */}
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

                  {/* FULL Badge */}
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

                  {/* Envio Próprio Badge */}
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
                
                {/* Resumo Total */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de anúncios ativos</span>
                    <span className="font-semibold">{shippingStats.total}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Avisos */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <CardTitle>Avisos Importantes</CardTitle>
                </div>
                <CardDescription>Últimas notificações e comunicados</CardDescription>
              </CardHeader>
              <CardContent>
                {notices.length === 0 ? (
                  <p className="text-foreground-secondary text-sm">Nenhum aviso no momento</p>
                ) : (
                  <div className="space-y-3">
                    {notices.map((notice) => (
                      <div 
                        key={notice.id} 
                        className={`rounded-lg p-4 ${
                          notice.is_important 
                            ? 'bg-primary/10 border-l-4 border-primary' 
                            : 'border-l-4 border-border bg-background-elevated'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1">
                            {notice.is_important && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                            <h4 className={`font-semibold text-foreground ${notice.is_important ? 'text-primary' : ''}`}>
                              {notice.title}
                            </h4>
                          </div>
                        </div>
                        <p className="text-sm text-foreground-secondary mt-2">{notice.content}</p>
                        <p className="text-xs text-foreground-secondary mt-2">
                          {format(new Date(notice.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Links Importantes */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-primary" />
                  <CardTitle>Links Importantes</CardTitle>
                </div>
                <CardDescription>Acesso rápido</CardDescription>
              </CardHeader>
              <CardContent>
                {importantLinks.length === 0 ? (
                  <p className="text-foreground-secondary text-sm">Nenhum link cadastrado</p>
                ) : (
                  <div className="space-y-2">
                    {importantLinks.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-border hover:bg-background-elevated transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-medium text-foreground text-sm">{link.title}</h4>
                          <LinkIcon className="w-4 h-4 text-primary shrink-0" />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Planejamento de Calls */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle>Próximas Calls de Segunda-feira</CardTitle>
              </div>
              <CardDescription>Temas e datas das mentorias</CardDescription>
            </CardHeader>
            <CardContent>
              {callSchedules.length === 0 ? (
                <p className="text-foreground-secondary text-sm">Nenhuma call agendada no momento</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {callSchedules.map((schedule) => (
                    <div key={schedule.id} className="p-4 rounded-lg border border-border bg-background-elevated">
                      <div className="text-sm font-medium text-primary mb-2">
                        {format(new Date(schedule.date), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                      <h4 className="font-semibold text-foreground mb-1">{schedule.theme}</h4>
                      {schedule.description && formatDescription(schedule.description)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contas Mercado Livre */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-primary" />
                  <CardTitle>Contas Mercado Livre</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  onClick={handleConnectML}
                  disabled={connectingML}
                  variant="outline"
                >
                  {connectingML ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  Conectar Conta
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mlAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-foreground-secondary mb-4">
                    Conecte sua conta do Mercado Livre para validação automática de milestones e acompanhamento de métricas
                  </p>
                  <Button onClick={handleConnectML} disabled={connectingML}>
                    {connectingML ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Conectando...</>
                    ) : (
                      'Conectar Primeira Conta'
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {mlAccounts.map(account => (
                    <div 
                      key={account.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                        <div>
                          <p className="font-semibold">{account.ml_nickname}</p>
                          <p className="text-xs text-foreground-secondary">
                            Conectada em {format(new Date(account.connected_at), "dd/MM/yyyy")}
                          </p>
                          <p className="text-xs text-foreground-secondary">
                            Sincronizada em {account.last_sync_at 
                              ? format(new Date(account.last_sync_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                              : 'Nunca sincronizada'}
                          </p>
                        </div>
                        {account.is_primary && (
                          <Badge variant="default">Principal</Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSetPrimaryAccount(account.id)}
                          className="h-9 w-9 p-0"
                          title={account.is_primary ? "Conta principal" : "Definir como principal"}
                        >
                          <Star 
                            className={`w-5 h-5 ${
                              account.is_primary 
                                ? 'fill-primary text-primary' 
                                : 'text-muted-foreground hover:text-primary'
                            }`}
                          />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleSyncAccount(account.id)}
                        >
                          Sincronizar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          <Unplug className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico Mensal */}
          {monthlyHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📈 Histórico Mensal</CardTitle>
                <CardDescription>Evolução dos últimos meses (dados consolidados)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {monthlyHistory.map((month) => (
                    <div key={month.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                      <div className="flex-1">
                        <p className="font-semibold text-base">
                          {format(new Date(month.reference_month + 'T00:00:00'), 'MMMM yyyy', { locale: ptBR })}
                        </p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-sm text-muted-foreground">
                            {month.total_sales} vendas
                          </p>
                          <p className="text-sm font-medium text-green-600">
                            {formatCurrency(month.total_revenue)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Ads: {formatCurrency(month.ads_total_spend)}
                        </p>
                        <p className="text-sm font-semibold text-green-500">
                          ROAS: {month.ads_roas.toFixed(2)}x
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
