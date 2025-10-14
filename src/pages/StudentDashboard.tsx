import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Calendar, Link as LinkIcon, TrendingUp, DollarSign, Package, CheckCircle2, ShoppingBag, Plus, Unplug, Star, Crown, Circle, ExternalLink, ShoppingCart, MapPin, Truck, Warehouse } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { ReputationBadge } from '@/components/ReputationBadge';

interface Notice {
  id: string;
  title: string;
  content: string;
  is_important: boolean;
  created_at: string;
}

interface CallSchedule {
  id: string;
  date: string;
  theme: string;
  description: string | null;
}

interface ImportantLink {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
}

interface MLAccount {
  id: string;
  ml_nickname: string;
  is_primary: boolean;
  is_active: boolean;
  connected_at: string;
  last_sync_at: string | null;
  metrics: MLMetrics | null;
}

interface MLMetrics {
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
  active_listings: number;
  reputation_level: string | null;
  reputation_color: string;
  reputation_transactions_total: number;
  positive_ratings_rate: number;
  has_decola: boolean;
  has_full: boolean;
  is_mercado_lider: boolean;
  mercado_lider_level: string | null;
}

interface ShippingStats {
  flex: { count: number; percentage: number };
  agencies: { count: number; percentage: number };
  collection: { count: number; percentage: number };
  full: { count: number; percentage: number };
  own: { count: number; percentage: number };
  total: number;
}

const StudentDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [callSchedules, setCallSchedules] = useState<CallSchedule[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [mlAccounts, setMlAccounts] = useState<MLAccount[]>([]);
  const [consolidatedMetrics, setConsolidatedMetrics] = useState<MLMetrics | null>(null);
  const [shippingStats, setShippingStats] = useState<ShippingStats | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30>(30);
  const [loading, setLoading] = useState(true);
  const [connectingML, setConnectingML] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Tratar parâmetros de retorno do OAuth do ML
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mlError = urlParams.get('ml_error');
    const mlConnected = urlParams.get('ml_connected');

    if (mlError) {
      toast({
        title: "Erro ao conectar Mercado Livre",
        description: decodeURIComponent(mlError),
        variant: "destructive",
      });
      // Limpar parâmetro da URL
      window.history.replaceState({}, '', '/aluno/dashboard');
    }

    if (mlConnected === 'true') {
      toast({
        title: "Conta conectada com sucesso!",
        description: "Sua conta do Mercado Livre foi conectada. Os dados serão sincronizados em breve.",
      });
      // Limpar parâmetro da URL e recarregar dados
      window.history.replaceState({}, '', '/aluno/dashboard');
      if (user) loadMLAccounts();
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      loadDashboardData();
      loadMLAccounts();
      
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
            loadMLAccounts();
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
            loadMLAccounts();
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
            loadMLAccounts();
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
            loadMLAccounts();
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
            loadMLAccounts();
          }
        )
        
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, userRole, authLoading, navigate]);

  // Recarregar quando o período mudar
  useEffect(() => {
    if (user && userRole === 'student' && mlAccounts.length > 0) {
      loadMLAccounts()
    }
  }, [selectedPeriod]);

  const loadDashboardData = async () => {
    try {
      const [noticesData, callSchedulesData, linksData] = await Promise.all([
        supabase.from('notices').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('call_schedules').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date', { ascending: true }).limit(4),
        supabase.from('important_links').select('*').order('order_index', { ascending: true })
      ]);

      if (noticesData.data) setNotices(noticesData.data);
      if (callSchedulesData.data) setCallSchedules(callSchedulesData.data);
      if (linksData.data) setImportantLinks(linksData.data);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateShippingStats = async (studentId: string): Promise<ShippingStats> => {
    const { data: products } = await supabase
      .from('mercado_livre_products')
      .select('shipping_mode, logistic_type')
      .eq('student_id', studentId)
      .eq('status', 'active');
    
    const total = products?.length || 0;
    
    const flex = products?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'drop_off'
    ).length || 0;
    
    const agencies = products?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'xd_drop_off'
    ).length || 0;
    
    const collection = products?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'cross_docking'
    ).length || 0;
    
    const full = products?.filter(p => 
      p.shipping_mode === 'me2' && p.logistic_type === 'fulfillment'
    ).length || 0;
    
    const own = total - (flex + agencies + collection + full);
    
    return {
      flex: { count: flex, percentage: total > 0 ? (flex / total) * 100 : 0 },
      agencies: { count: agencies, percentage: total > 0 ? (agencies / total) * 100 : 0 },
      collection: { count: collection, percentage: total > 0 ? (collection / total) * 100 : 0 },
      full: { count: full, percentage: total > 0 ? (full / total) * 100 : 0 },
      own: { count: own, percentage: total > 0 ? (own / total) * 100 : 0 },
      total
    };
  };

  const loadMLAccounts = async () => {
    try {
      if (!user) return
      
      // Buscar contas
      const { data: accountsData, error: accountsError } = await supabase.functions.invoke('ml-get-accounts')
      
      if (accountsError) {
        console.error('Error loading ML accounts:', accountsError)
        return
      }

      if (accountsData?.accounts) {
        setMlAccounts(accountsData.accounts)
        
        // Buscar TODOS os pedidos para calcular métricas dinâmicas
        const { data: orders, error: ordersError } = await supabase
          .from('mercado_livre_orders')
          .select('*')
          .eq('student_id', user.id)
          .eq('status', 'paid')
          .order('date_created', { ascending: false })
        
        if (ordersError) {
          console.error('Error loading orders:', ordersError)
          return
        }
        
        // Filtrar pedidos pelo período selecionado
        const periodStart = new Date()
        periodStart.setDate(periodStart.getDate() - selectedPeriod)
        
        const filteredOrders = orders?.filter(order => 
          new Date(order.date_created) >= periodStart
        ) || []
        
        // Calcular métricas do período
        const totalSales = filteredOrders.length
        const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0)
        const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0
        
        // Pegar outras métricas da primeira conta (não dependem de período)
        const firstAccountMetrics = accountsData.accounts[0]?.metrics
        
        setConsolidatedMetrics({
          total_sales: totalSales,
          total_revenue: totalRevenue,
          average_ticket: averageTicket,
          active_listings: firstAccountMetrics?.active_listings || 0,
          reputation_level: firstAccountMetrics?.reputation_level || null,
          reputation_color: firstAccountMetrics?.reputation_color || 'gray',
          reputation_transactions_total: firstAccountMetrics?.reputation_transactions_total || 0,
          positive_ratings_rate: firstAccountMetrics?.positive_ratings_rate || 0,
          has_decola: firstAccountMetrics?.has_decola || false,
          has_full: firstAccountMetrics?.has_full || false,
          is_mercado_lider: firstAccountMetrics?.is_mercado_lider || false,
          mercado_lider_level: firstAccountMetrics?.mercado_lider_level || null
        })
        
        // Carregar estatísticas de envio
        const stats = await calculateShippingStats(user.id);
        setShippingStats(stats);
      }
    } catch (error) {
      console.error('Error loading ML accounts:', error)
    }
  }

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
      
      loadMLAccounts()
    } catch (error) {
      console.error('Error disconnecting ML account:', error)
    }
  }

  const handleSyncAccount = async (accountId: string) => {
    try {
      toast({
        title: "Sincronizando...",
        description: "Buscando dados do Mercado Livre. Isso pode levar alguns segundos.",
      })

      const { error } = await supabase.functions.invoke('ml-sync-data', {
        body: { ml_account_id: accountId }
      })

      if (error) throw error

      toast({
        title: "Sincronização concluída",
        description: "Os dados foram atualizados com sucesso.",
      })

      loadMLAccounts()
    } catch (error) {
      console.error('Error syncing account:', error)
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os dados. Tente novamente.",
        variant: "destructive",
      })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }


  const formatDescription = (description: string) => {
    // Split by lines and check if it's a list format
    const lines = description.split('\n').map(line => line.trim()).filter(line => line);
    const hasListItems = lines.some(line => line.startsWith('-'));
    
    if (hasListItems) {
      return (
        <ul className="text-xs text-foreground-secondary space-y-1 mt-2 list-disc list-inside">
          {lines.map((line, index) => {
            if (line.startsWith('-')) {
              return (
                <li key={index} className="ml-3">
                  {line.substring(1).trim()}
                </li>
              );
            }
            return <p key={index} className="mt-1">{line}</p>;
          })}
        </ul>
      );
    }
    
    return <p className="text-xs text-foreground-secondary">{description}</p>;
  };

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
        <div className="max-w-7xl mx-auto">
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
                  : 'Métricas consolidadas de todas as suas contas do Mercado Livre'
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
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {consolidatedMetrics?.total_sales || 0}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        Últimos {selectedPeriod} dias
                      </p>
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

          {/* Badges de Tipo de Envio */}
          {mlAccounts.length > 0 && shippingStats && (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* FLEX Badge */}
                  {shippingStats.flex.count > 0 ? (
                    <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-400" />
                          <span className="font-semibold">FLEX</span>
                        </div>
                        <Badge className="bg-blue-500">
                          {shippingStats.flex.count} produto{shippingStats.flex.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={shippingStats.flex.percentage} className="h-1 flex-1" />
                        <span className="text-xs font-medium">{shippingStats.flex.percentage.toFixed(0)}%</span>
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

                  {/* Agências Badge */}
                  {shippingStats.agencies.count > 0 ? (
                    <div className="p-4 rounded-lg border border-purple-500/50 bg-purple-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-purple-400" />
                          <span className="font-semibold">Agências</span>
                        </div>
                        <Badge className="bg-purple-500">
                          {shippingStats.agencies.count} produto{shippingStats.agencies.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={shippingStats.agencies.percentage} className="h-1 flex-1" />
                        <span className="text-xs font-medium">{shippingStats.agencies.percentage.toFixed(0)}%</span>
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

                  {/* Coleta Badge */}
                  {shippingStats.collection.count > 0 ? (
                    <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-5 h-5 text-green-400" />
                          <span className="font-semibold">Coleta</span>
                        </div>
                        <Badge className="bg-green-500">
                          {shippingStats.collection.count} produto{shippingStats.collection.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={shippingStats.collection.percentage} className="h-1 flex-1" />
                        <span className="text-xs font-medium">{shippingStats.collection.percentage.toFixed(0)}%</span>
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

                  {/* FULL Badge */}
                  {shippingStats.full.count > 0 ? (
                    <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Warehouse className="w-5 h-5 text-orange-400" />
                          <span className="font-semibold">FULL</span>
                        </div>
                        <Badge className="bg-orange-500">
                          {shippingStats.full.count} produto{shippingStats.full.count !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={shippingStats.full.percentage} className="h-1 flex-1" />
                        <span className="text-xs font-medium">{shippingStats.full.percentage.toFixed(0)}%</span>
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
                
                {/* Resumo Total */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total de anúncios ativos</span>
                    <span className="font-semibold">{shippingStats.total}</span>
                  </div>
                  {shippingStats.own.count > 0 && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Envio próprio</span>
                      <span>{shippingStats.own.count} ({shippingStats.own.percentage.toFixed(0)}%)</span>
                    </div>
                  )}
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
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
