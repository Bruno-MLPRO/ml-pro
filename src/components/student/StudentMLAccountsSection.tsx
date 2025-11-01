import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReputationBadge } from "@/components/ReputationBadge";
import { MiniSparklineChart } from "@/components/MiniSparklineChart";
import { 
  ShoppingCart, RefreshCw, Star, ExternalLink, Award, Target, 
  Package, DollarSign, TrendingUp, XCircle, AlertTriangle, 
  Image, Mail, MapPin, Truck, Warehouse, Send
} from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useMLDailyMetrics } from "@/hooks/queries/useMLDailyMetrics";
import type { ShippingStats } from "@/types/metrics";
import type { MLAccount, MLProduct, MLFullStock, MLCampaign, AdsMetrics, MLSellerRecovery } from "@/types/mercadoLivre";
import MLider from "@/assets/MLider.png";
import MLiderGold from "@/assets/MLiderGold.png";
import MLiderPlatinum from "@/assets/MLiderPlatinum.png";

interface MLMetrics {
  total_sales: number;
  total_revenue: number;
  average_ticket: number;
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
}

interface StudentMLAccountsSectionProps {
  mlAccounts: MLAccount[];
  selectedAccountId: string;
  onAccountChange: (accountId: string) => void;
  metrics: MLMetrics | null;
  products: MLProduct[];
  fullStock: MLFullStock[];
  campaigns: MLCampaign[];
  adsMetrics: AdsMetrics | null;
  shippingStats: ShippingStats | null;
  sellerRecovery: MLSellerRecovery | null;
  isSyncing: boolean;
  onSync: () => void;
  onSetPrimaryAccount: (accountId: string) => void;
  studentId?: string;
}

export function StudentMLAccountsSection({
  mlAccounts,
  selectedAccountId,
  onAccountChange,
  metrics,
  products,
  fullStock,
  campaigns,
  adsMetrics,
  shippingStats,
  sellerRecovery,
  isSyncing,
  onSync,
  onSetPrimaryAccount,
  studentId
}: StudentMLAccountsSectionProps) {
  // Buscar dados diários para os mini gráficos
  const { data: dailyMetrics } = useMLDailyMetrics(selectedAccountId || null, studentId || null);
  const getMercadoLivreStoreUrl = (nickname: string): string => {
    return `https://www.mercadolivre.com.br/perfil/${nickname}`;
  };

  const isGuaranteeActive = (): boolean => {
    if (metrics?.has_decola) return true;
    
    if (metrics?.protection_end_date) {
      const endDate = new Date(metrics.protection_end_date);
      const now = new Date();
      if (endDate > now) return true;
    }
    
    if (metrics?.real_reputation_level && metrics?.protection_end_date) {
      const endDate = new Date(metrics.protection_end_date);
      const now = new Date();
      if (endDate > now) return true;
    }
    
    if (sellerRecovery) {
      if (sellerRecovery.status === 'ACTIVE') return true;
      if (sellerRecovery.guarantee_status === 'ON') return true;
      if (sellerRecovery.end_date) {
        const endDate = new Date(sellerRecovery.end_date);
        const now = new Date();
        if (endDate > now) return true;
      }
    }
    
    return false;
  };

  const getColorNameInPortuguese = (colorCode: string): string => {
    if (!colorCode) return 'Sem Avaliações';
    
    const colorMap: { [key: string]: string } = {
      'red': 'Vermelho',
      '1_red': 'Vermelho',
      'orange': 'Laranja',
      '2_orange': 'Laranja',
      'yellow': 'Amarelo',
      '3_yellow': 'Amarelo',
      'light_green': 'Verde Claro',
      '4_light_green': 'Verde Claro',
      'green': 'Verde Escuro',
      '5_green': 'Verde Escuro',
      'newbie': 'Sem Avaliações',
    };
    
    if (colorMap[colorCode]) return colorMap[colorCode];
    if ((colorCode.includes('green') && colorCode.startsWith('5')) || colorCode === 'green') {
      return 'Verde Escuro';
    }
    if (colorCode.includes('green')) return 'Verde Claro';
    if (colorCode.includes('yellow')) return 'Amarelo';
    if (colorCode.includes('orange')) return 'Laranja';
    if (colorCode.includes('red')) return 'Vermelho';
    
    return colorCode || 'Sem Avaliações';
  };

  const lowQualityProducts = products.filter(p => p.health?.health_level === 'critical' || (p.health?.health_score || 0) < 40);
  const noDescriptionProducts = products.filter(p => !p.has_description);
  const noTaxDataProducts = products.filter(p => !p.has_tax_data);

  const totalStockUnits = fullStock.reduce((sum, item) => 
    sum + (item.available_units || 0) + (item.reserved_units || 0), 0
  );

  const calculateFullStockFinancials = () => {
    const totalUnits = fullStock.reduce((sum, item) => 
      sum + (item.available_units || 0), 0
    );
    
    const totalRevenue = fullStock.reduce((sum, item) => {
      const product = products.find(p => p.ml_item_id === item.ml_item_id);
      const price = product?.price || 0;
      const units = item.available_units || 0;
      return sum + (units * price);
    }, 0);
    
    const payout = totalRevenue * 0.78;
    
    return {
      totalUnits,
      totalRevenue,
      payout
    };
  };

  const fullFinancials = metrics?.has_full ? calculateFullStockFinancials() : null;

  if (mlAccounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
          <p className="text-muted-foreground">
            Este aluno ainda não conectou nenhuma conta do Mercado Livre
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedAccount = mlAccounts.find(a => a.id === selectedAccountId);

  return (
    <>
      {/* Selector de Conta */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Contas do Mercado Livre</h3>
        <Select value={selectedAccountId} onValueChange={onAccountChange}>
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

      {selectedAccountId && selectedAccount && (
        <>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Coluna 1: Status da Conta + Reputação - 50% */}
            <div className="flex-[0.50] flex flex-col gap-4">
              {/* Status da Conta */}
              <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Status da Conta</CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onSync}
                    disabled={isSyncing}
                    className="h-8 gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nome da Conta</span>
                      <a 
                        href={getMercadoLivreStoreUrl(selectedAccount.ml_nickname)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        @{selectedAccount.ml_nickname}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      <Badge variant={selectedAccount.is_active ? "default" : "secondary"}>
                        {selectedAccount.is_active ? "Ativa" : "Inativa"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Conta Principal</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSetPrimaryAccount(selectedAccount.id)}
                        className="h-7 w-7 p-0"
                      >
                        <Star className={`w-4 h-4 ${selectedAccount.is_primary ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                      </Button>
                    </div>
                    {selectedAccount.last_sync_at && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Última Sincronização</span>
                        <span className="font-medium text-sm">
                          {new Date(selectedAccount.last_sync_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reputação */}
              <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Reputação</CardTitle>
                </CardHeader>
                <CardContent>
                  {metrics && (
                    <>
                      <ReputationBadge
                        color={metrics.reputation_color}
                        levelId={metrics.reputation_level}
                        positiveRate={metrics.positive_ratings_rate}
                        totalTransactions={metrics.reputation_transactions_total}
                      />

                      {metrics.is_mercado_lider && (
                        <div className="mt-3 flex items-center gap-2">
                          <img
                            src={
                              metrics.mercado_lider_level === 'platinum'
                                ? MLiderPlatinum
                                : metrics.mercado_lider_level === 'gold'
                                  ? MLiderGold
                                  : MLider
                            }
                            alt="Selo Mercado Líder"
                            className="h-5 w-5"
                          />
                          <span className="text-sm font-semibold">
                            {metrics.mercado_lider_level === 'platinum'
                              ? 'Mercado Líder Platinum'
                              : metrics.mercado_lider_level === 'gold'
                                ? 'Mercado Líder Gold'
                                : 'Mercado Líder'}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Problemas de Qualidade */}
              {metrics && (
                <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500 animate-pulse" />
                      Problemas de Qualidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-red-200 dark:border-red-800 hover:border-red-300 dark:hover:border-red-700 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Image className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium">Fotos Baixa Qualidade</span>
                      </div>
                      <Badge variant="outline" className="text-red-600 border-red-300">
                        {lowQualityProducts.length} anúncios
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-orange-200 dark:border-orange-800 hover:border-orange-300 dark:hover:border-orange-700 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-orange-500" />
                        <span className="text-sm font-medium">Sem Descrição</span>
                      </div>
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        {noDescriptionProducts.length} anúncios
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm font-medium">Sem Dados Fiscais</span>
                      </div>
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                        {noTaxDataProducts.length} anúncios
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Coluna 2: Métricas - 20% */}
            {metrics && (
              <div className="flex-[0.20] flex flex-col gap-3">
                <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-center gap-1">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      Vendas Totais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-4 pt-3 flex flex-col min-h-0">
                    <div className="text-3xl font-bold mb-auto flex-shrink-0">{metrics.total_sales}</div>
                    <div className="mt-auto flex-shrink-0 pt-3">
                      {dailyMetrics && dailyMetrics.length > 0 && (
                        <div className="mb-2 overflow-hidden">
                          <MiniSparklineChart
                            data={dailyMetrics.map(day => ({ date: day.date, value: day.sales }))}
                            color="#10b981"
                            height={35}
                          />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-center gap-1">
                      <DollarSign className="w-4 h-4 text-blue-600" />
                      Faturamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-4 pt-3 flex flex-col min-h-0">
                    <div className="text-3xl font-bold mb-auto flex-shrink-0">
                      {new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(metrics.total_revenue)}
                    </div>
                    <div className="mt-auto flex-shrink-0 pt-3">
                      {dailyMetrics && dailyMetrics.length > 0 && (
                        <div className="mb-2 overflow-hidden">
                          <MiniSparklineChart
                            data={dailyMetrics.map(day => ({ date: day.date, value: day.revenue }))}
                            color="#3b82f6"
                            height={35}
                          />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center justify-center gap-1">
                      <ShoppingCart className="w-4 h-4 text-violet-600" />
                      Ticket Médio
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pb-4 pt-3 flex flex-col min-h-0">
                    <div className="text-3xl font-bold mb-auto flex-shrink-0">
                      {new Intl.NumberFormat('pt-BR', { 
                        style: 'currency', 
                        currency: 'BRL' 
                      }).format(metrics.average_ticket)}
                    </div>
                    <div className="mt-auto flex-shrink-0 pt-3">
                      {dailyMetrics && dailyMetrics.length > 0 && (
                        <div className="mb-2 overflow-hidden">
                          <MiniSparklineChart
                            data={dailyMetrics.map(day => ({ date: day.date, value: day.ticket }))}
                            color="#8b5cf6"
                            height={35}
                          />
                        </div>
                      )}
                      <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Coluna 3: Programas Especiais - 30% */}
            {metrics && (
              <div className="flex-[0.30] flex flex-col gap-3">
                {/* Garantia de Reputação */}
                <Card className="transition-all duration-300 hover:shadow-lg border border-border flex-1">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4" />
                        Garantia de Reputação
                      </div>
                      {isGuaranteeActive() && (
                        <Badge variant="default" className="text-xs">Ativo</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isGuaranteeActive() ? (
                      <div className="space-y-3">
                        {(metrics.real_reputation_level || sellerRecovery?.current_level) && (
                          <div>
                            <span className="text-xs text-muted-foreground">Reputação Real</span>
                            <p className="text-sm font-medium">
                              {getColorNameInPortuguese(metrics.real_reputation_level || sellerRecovery?.current_level || '')}
                            </p>
                            {metrics.is_mercado_lider && metrics.mercado_lider_level && (
                              <Badge variant="outline" className="text-xs mt-1">
                                👑 Power Seller: {metrics.mercado_lider_level === 'platinum' ? 'Platinum' : 
                                   metrics.mercado_lider_level === 'gold' ? 'Gold' : 
                                   metrics.mercado_lider_level === 'silver' ? 'Silver' : 
                                   metrics.mercado_lider_level === 'bronze' ? 'Bronze' : 
                                   metrics.mercado_lider_level}
                              </Badge>
                            )}
                          </div>
                        )}
                        {(sellerRecovery || metrics.has_decola || metrics.decola_problems_count !== undefined) && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm">Problemas</span>
                              <span className={`text-sm font-bold ${
                                (() => {
                                  if (metrics.has_decola) {
                                    const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                    const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                    if (problemsFromMetrics >= maxIssues - 1) return 'text-red-500';
                                    if (problemsFromMetrics >= maxIssues - 2) return 'text-orange-500';
                                    return 'text-green-500';
                                  }
                                  if (sellerRecovery) {
                                    const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                    const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                    if (totalIssues >= maxIssues - 1) return 'text-red-500';
                                    if (totalIssues >= maxIssues - 2) return 'text-orange-500';
                                    return 'text-green-500';
                                  }
                                  const problems = metrics.decola_problems_count ?? 0;
                                  if (problems >= 4) return 'text-red-500';
                                  if (problems >= 3) return 'text-orange-500';
                                  return 'text-green-500';
                                })()
                              }`}>
                                {(() => {
                                  if (metrics.has_decola) {
                                    const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                    const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                    return `${problemsFromMetrics}/${maxIssues}`;
                                  }
                                  if (sellerRecovery) {
                                    const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                    const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                    return `${totalIssues}/${maxIssues}`;
                                  }
                                  return `${metrics.decola_problems_count ?? 0}/5`;
                                })()}
                              </span>
                            </div>
                            <Progress 
                              value={(() => {
                                if (metrics.has_decola) {
                                  const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                  const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                  return (problemsFromMetrics / maxIssues) * 100;
                                }
                                if (sellerRecovery) {
                                  const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                  const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                  return (totalIssues / maxIssues) * 100;
                                }
                                return ((metrics.decola_problems_count ?? 0) / 5) * 100;
                              })()} 
                              className={`h-2 ${
                                (() => {
                                  if (metrics.has_decola) {
                                    const problemsFromMetrics = (metrics.claims_value || 0) + (metrics.delayed_handling_value || 0) + (metrics.cancellations_value || 0);
                                    const maxIssues = sellerRecovery?.max_issues_allowed ?? 5;
                                    if (problemsFromMetrics >= maxIssues - 1) return '[&>div]:bg-red-500';
                                    if (problemsFromMetrics >= maxIssues - 2) return '[&>div]:bg-orange-500';
                                    return '[&>div]:bg-green-500';
                                  }
                                  if (sellerRecovery) {
                                    const totalIssues = sellerRecovery.total_issues ?? (sellerRecovery.claims_qty + sellerRecovery.delay_qty + sellerRecovery.cancel_qty);
                                    const maxIssues = sellerRecovery.max_issues_allowed ?? 5;
                                    if (totalIssues >= maxIssues - 1) return '[&>div]:bg-red-500';
                                    if (totalIssues >= maxIssues - 2) return '[&>div]:bg-orange-500';
                                    return '[&>div]:bg-green-500';
                                  }
                                  const problems = metrics.decola_problems_count ?? 0;
                                  if (problems >= 4) return '[&>div]:bg-red-500';
                                  if (problems >= 3) return '[&>div]:bg-orange-500';
                                  return '[&>div]:bg-green-500';
                                })()
                              }`}
                            />
                          </div>
                        )}
                        {(sellerRecovery?.end_date || metrics.protection_end_date) && (
                          <div>
                            <span className="text-xs text-muted-foreground">Válido até</span>
                            <p className="text-xs font-medium">
                              {new Date(sellerRecovery?.end_date || metrics.protection_end_date || '').toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}
                        {sellerRecovery?.guarantee_price && (
                          <div>
                            <span className="text-xs text-muted-foreground">Valor de garantia</span>
                            <p className="text-sm font-medium">
                              {formatCurrency(sellerRecovery.guarantee_price)}
                            </p>
                          </div>
                        )}
                        {sellerRecovery?.advertising_amount && (
                          <div>
                            <span className="text-xs text-muted-foreground">Valor de bonus em ADS</span>
                            <p className="text-sm font-medium">
                              {formatCurrency(sellerRecovery.advertising_amount)}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Não ativo</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Product ADS */}
                <Card className="transition-all duration-300 hover:shadow-lg border border-border flex-1">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Product ADS
                      </div>
                      {adsMetrics && adsMetrics.activeCampaigns > 0 && (
                        <Badge variant="default" className="text-xs">
                          {adsMetrics.activeCampaigns} {adsMetrics.activeCampaigns === 1 ? 'Ativa' : 'Ativas'}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {adsMetrics && adsMetrics.activeCampaigns > 0 ? (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <DollarSign className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span className="text-xs text-muted-foreground">Investimento</span>
                            </div>
                            <p className="text-base font-bold text-purple-600 dark:text-purple-400">
                              {adsMetrics.totalSpend.toLocaleString('pt-BR', { 
                                style: 'currency', 
                                currency: 'BRL' 
                              })}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">Produtos</span>
                            <p className="text-sm font-medium">
                              {adsMetrics.totalProductsInAds} anunciados
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3 border-l pl-4">
                          <div>
                            <span className="text-xs text-muted-foreground">ROAS</span>
                            <p className={`text-base font-bold ${
                              adsMetrics.totalRoas >= 3 ? 'text-green-600 dark:text-green-400' :
                              adsMetrics.totalRoas >= 2 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {adsMetrics.totalRoas.toFixed(1)}x
                            </p>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground">ACOS</span>
                            <p className={`text-base font-bold ${
                              adsMetrics.totalAcos <= 25 ? 'text-green-600 dark:text-green-400' :
                              adsMetrics.totalAcos <= 40 ? 'text-yellow-600 dark:text-yellow-400' :
                              'text-red-600 dark:text-red-400'
                            }`}>
                              {adsMetrics.totalAcos.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Sem campanhas ativas</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* FULL */}
                <Card className="transition-all duration-300 hover:shadow-lg border border-border flex-1">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Mercado Livre FULL
                      </div>
                      {metrics.has_full && <Badge variant="default" className="text-xs">Ativo</Badge>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {metrics.has_full && fullFinancials ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex flex-col items-center justify-center h-full">
                              <span className="text-xs text-muted-foreground mb-1">Estoque Total</span>
                              <span className="text-2xl font-bold">{totalStockUnits}</span>
                              <span className="text-xs text-muted-foreground">unidades</span>
                            </div>
                          </div>
                          <div className="space-y-3 border-l pl-4">
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <DollarSign className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                <span className="text-xs text-muted-foreground">Faturamento Previsto</span>
                              </div>
                              <p className="text-base font-bold text-blue-600 dark:text-blue-400">
                                {fullFinancials.totalRevenue.toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                })}
                              </p>
                            </div>
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-xs text-muted-foreground">Payout Previsto</span>
                              </div>
                              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                {fullFinancials.payout.toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <XCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Não ativo</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Tipos de Envio e Problemas */}
          {metrics && (
            <>
              {/* Tipos de Envio */}
              {shippingStats && (
                <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-primary" />
                      Tipos de Envio
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Distribuição de anúncios por modalidade de envio - Conta @{selectedAccount.ml_nickname}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {/* Correios */}
                      {shippingStats.correios.count > 0 ? (
                        <div className="p-4 rounded-lg border border-cyan-500/50 bg-cyan-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-cyan-400" />
                              <span className="text-sm font-semibold">Correios</span>
                            </div>
                            <Badge className="bg-cyan-500 text-xs">
                              {shippingStats.correios.count}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={shippingStats.correios.percentage} className="h-1 flex-1" />
                            <span className="text-xs font-medium">{shippingStats.correios.percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">Correios</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
                        </div>
                      )}

                      {/* FLEX */}
                      {shippingStats.flex.count > 0 ? (
                        <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-blue-400" />
                              <span className="text-sm font-semibold">FLEX</span>
                            </div>
                            <Badge className="bg-blue-500 text-xs">
                              {shippingStats.flex.count}
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
                              <Package className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">FLEX</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
                        </div>
                      )}

                      {/* Agências */}
                      {shippingStats.agencies.count > 0 ? (
                        <div className="p-4 rounded-lg border border-purple-500/50 bg-purple-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-purple-400" />
                              <span className="text-sm font-semibold">Agências</span>
                            </div>
                            <Badge className="bg-purple-500 text-xs">
                              {shippingStats.agencies.count}
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
                              <MapPin className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">Agências</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
                        </div>
                      )}

                      {/* Coleta */}
                      {shippingStats.collection.count > 0 ? (
                        <div className="p-4 rounded-lg border border-gray-500/50 bg-gray-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-semibold">Coleta</span>
                            </div>
                            <Badge className="bg-gray-500 text-xs">
                              {shippingStats.collection.count}
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
                              <Truck className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">Coleta</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
                        </div>
                      )}

                      {/* FULL */}
                      {shippingStats.full.count > 0 ? (
                        <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Warehouse className="w-4 h-4 text-orange-400" />
                              <span className="text-sm font-semibold">FULL</span>
                            </div>
                            <Badge className="bg-orange-500 text-xs">
                              {shippingStats.full.count}
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
                              <Warehouse className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">FULL</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
                        </div>
                      )}

                      {/* Envio Próprio */}
                      {shippingStats.envio_proprio.count > 0 ? (
                        <div className="p-4 rounded-lg border border-indigo-500/50 bg-indigo-500/10">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-indigo-400" />
                              <span className="text-sm font-semibold">Envio Próprio</span>
                            </div>
                            <Badge className="bg-indigo-500 text-xs">
                              {shippingStats.envio_proprio.count}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={shippingStats.envio_proprio.percentage} className="h-1 flex-1" />
                            <span className="text-xs font-medium">{shippingStats.envio_proprio.percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border border-border/50 bg-transparent">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Send className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm font-semibold text-muted-foreground">Envio Próprio</span>
                            </div>
                            <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                          </div>
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
          )}
        </>
      )}
    </>
  );
}
