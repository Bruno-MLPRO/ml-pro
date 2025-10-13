import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, TrendingUp, Package, AlertTriangle, Image } from "lucide-react";
import { toast } from "sonner";
import { ReputationBadge } from "@/components/ReputationBadge";

export default function MLAccountPerformance() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<any>(null);
  const [fullStock, setFullStock] = useState<any[]>([]);
  const [lowQualityProducts, setLowQualityProducts] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<7 | 15 | 30>(30);

  useEffect(() => {
    loadAccountData();
    
    // Realtime para página de desempenho
    const channel = supabase
      .channel(`ml-account-${accountId}-realtime`)
      
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mercado_livre_metrics',
          filter: `ml_account_id=eq.${accountId}`
        },
        () => {
          console.log('Account metrics updated');
          loadAccountData();
        }
      )
      
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mercado_livre_orders',
          filter: `ml_account_id=eq.${accountId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            toast.success('Nova venda! 🎉');
          }
          loadAccountData();
        }
      )
      
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mercado_livre_products',
          filter: `ml_account_id=eq.${accountId}`
        },
        () => {
          console.log('Products updated');
          loadAccountData();
        }
      )
      
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mercado_livre_full_stock',
          filter: `ml_account_id=eq.${accountId}`
        },
        () => {
          console.log('FULL stock updated');
          loadAccountData();
        }
      )
      
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, selectedPeriod]);

  const loadAccountData = async () => {
    try {
      setLoading(true);
      
      // Buscar conta
      const { data: accountData, error: accountError } = await supabase
        .from('mercado_livre_accounts')
        .select('*')
        .eq('id', accountId)
        .single();

      if (accountError) throw accountError;
      setAccount(accountData);

      // Buscar métricas com cálculo dinâmico por período
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - selectedPeriod);

      const { data: orders } = await supabase
        .from('mercado_livre_orders')
        .select('*')
        .eq('ml_account_id', accountId)
        .eq('status', 'paid')
        .gte('date_created', periodStart.toISOString());

      // Calcular métricas do período
      const totalSales = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      setAccount((prev: any) => ({
        ...prev,
        periodMetrics: {
          total_sales: totalSales,
          total_revenue: totalRevenue,
          average_ticket: averageTicket
        }
      }));

      // Buscar estoque FULL
      const { data: fullStockData } = await supabase
        .from('mercado_livre_full_stock')
        .select('*')
        .eq('ml_account_id', accountId);

      setFullStock(fullStockData || []);

      // Buscar produtos com fotos de baixa qualidade
      const { data: lowQualityData } = await supabase
        .from('mercado_livre_products')
        .select('*')
        .eq('ml_account_id', accountId)
        .eq('has_low_quality_photos', true)
        .eq('status', 'active')
        .order('sold_quantity', { ascending: false });

      setLowQualityProducts(lowQualityData || []);

    } catch (error: any) {
      console.error('Error loading account data:', error);
      toast.error('Erro ao carregar dados da conta');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dados da conta...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Conta não encontrada</p>
            <Button onClick={() => navigate('/aluno/dashboard')} className="mt-4">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalAvailable = fullStock.reduce((sum, item) => sum + item.available_units, 0);
  const totalReserved = fullStock.reduce((sum, item) => sum + item.reserved_units, 0);
  const totalDamaged = fullStock.reduce((sum, item) => sum + item.damaged_units, 0);
  const totalInbound = fullStock.reduce((sum, item) => sum + item.inbound_units, 0);

  const metrics = account.periodMetrics || {};

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/aluno/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">@{account.ml_nickname}</h1>
              <p className="text-muted-foreground">Dashboard de Desempenho</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={selectedPeriod === 7 ? "default" : "outline"}
              onClick={() => setSelectedPeriod(7)}
              size="sm"
            >
              7 dias
            </Button>
            <Button
              variant={selectedPeriod === 15 ? "default" : "outline"}
              onClick={() => setSelectedPeriod(15)}
              size="sm"
            >
              15 dias
            </Button>
            <Button
              variant={selectedPeriod === 30 ? "default" : "outline"}
              onClick={() => setSelectedPeriod(30)}
              size="sm"
            >
              30 dias
            </Button>
          </div>
        </div>

        {/* Métricas Principais */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas ({selectedPeriod}d)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total_sales || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(metrics.total_revenue || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                }).format(metrics.average_ticket || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reputação e Métricas de Qualidade */}
        {account.reputation_color && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Reputação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ReputationBadge
                color={account.reputation_color}
                levelId={account.reputation_level}
                positiveRate={account.positive_ratings_rate || 0}
                totalTransactions={account.reputation_transactions_total || 0}
              />
              
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-4">Métricas de Qualidade (Últimos 60 dias)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Reclamações</p>
                    <p className="text-2xl font-bold">
                      {((account.claims_rate || 0) * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.claims_value || 0} casos
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Atrasos</p>
                    <p className="text-2xl font-bold">
                      {((account.delayed_handling_rate || 0) * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.delayed_handling_value || 0} atrasos
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-1">Cancelamentos</p>
                    <p className="text-2xl font-bold">
                      {((account.cancellations_rate || 0) * 100).toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.cancellations_value || 0} cancelados
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estoque FULL */}
        {fullStock.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Estoque FULL
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Disponível</p>
                  <p className="text-2xl font-bold text-green-600">{totalAvailable} un</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Reservado</p>
                  <p className="text-2xl font-bold text-blue-600">{totalReserved} un</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Em Trânsito</p>
                  <p className="text-2xl font-bold text-yellow-600">{totalInbound} un</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Danificado</p>
                  <p className="text-2xl font-bold text-red-600">{totalDamaged} un</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uso do Espaço</span>
                  <span className="font-medium">
                    {totalAvailable + totalReserved} / {totalAvailable + totalReserved + totalInbound}
                  </span>
                </div>
                <Progress 
                  value={((totalAvailable + totalReserved) / (totalAvailable + totalReserved + totalInbound || 1)) * 100} 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Alertas de Qualidade de Fotos */}
        {lowQualityProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Anúncios com Fotos Abaixo de 1200x1200px
                <Badge variant="destructive">{lowQualityProducts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lowQualityProducts.slice(0, 10).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <img 
                        src={product.thumbnail} 
                        alt={product.title}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm line-clamp-1">{product.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Image className="h-3 w-3" />
                            {product.photo_count} fotos
                          </span>
                          <span>•</span>
                          <span className="text-yellow-600">
                            Menor: {product.min_photo_dimension}px
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => window.open(product.permalink, '_blank')}
                    >
                      Ver Anúncio
                    </Button>
                  </div>
                ))}
              </div>
              {lowQualityProducts.length > 10 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  + {lowQualityProducts.length - 10} produtos com fotos de baixa qualidade
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mensagem se não houver alertas */}
        {lowQualityProducts.length === 0 && (
          <Card className="border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
                <Package className="h-5 w-5" />
                <p className="font-medium">
                  ✅ Todos os anúncios ativos têm fotos de alta qualidade (≥ 1200x1200px)
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}