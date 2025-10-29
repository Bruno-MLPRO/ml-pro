import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { useStudentProfile, useStudentMLAccounts, useStudentApps, useStudentJourneys, useJourneyTemplates, useAvailableApps, useStudentBonusDeliveries, useConsolidatedAccountMetrics } from "@/hooks/queries/useStudentData";
import { useMLAccountData } from "@/hooks/queries/useMLAccountData";
import { calculateAdsMetrics, calculateShippingStats } from "@/lib/calculations";
import { PlanBonusCard } from "@/components/PlanBonusCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReputationBadge } from "@/components/ReputationBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Building2, DollarSign, Package, 
  TrendingUp, ShoppingCart, Award, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, Home, Image, Plus, RefreshCw, Target, Star, Send, Truck, Warehouse
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StudentProfile, StudentApp, BonusDelivery } from "@/types/students";
import type { Milestone } from "@/types/journeys";
import type { MLAccount, MLProduct, MLFullStock, MLCampaign, AdsMetrics } from "@/types/mercadoLivre";
import type { ShippingStats } from "@/types/metrics";

// Interfaces removidas - usando tipos centralizados de @/types

// MLMetrics ainda é local pois tem campos específicos diferentes do tipo centralizado
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

// Todas as interfaces removidas - usando tipos centralizados de @/types/mercadoLivre, @/types/students e @/types/journeys

export default function StudentDetails() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hooks para buscar dados do estudante
  const { data: student, isLoading: loadingStudent } = useStudentProfile(studentId || null);
  const { data: mlAccountsData = [], isLoading: loadingAccounts } = useStudentMLAccounts(studentId || null);
  const { data: studentAppsData = [], isLoading: loadingApps } = useStudentApps(studentId || null);
  const { data: journeysData = [], isLoading: loadingJourneys } = useStudentJourneys(studentId || null);
  const { data: journeyTemplatesData = [] } = useJourneyTemplates();
  const { data: availableAppsData = [] } = useAvailableApps();
  const { data: bonusDeliveriesData = [] } = useStudentBonusDeliveries(studentId || null);
  
  // Transformar dados para compatibilidade
  const mlAccounts = mlAccountsData.map((acc: any) => ({
    id: acc.id,
    ml_nickname: acc.ml_nickname || acc.nickname || 'Sem nome',
    ml_user_id: acc.ml_user_id.toString(),
    is_primary: acc.is_primary,
    is_active: acc.is_active,
    connected_at: acc.connected_at || acc.created_at || '',
    last_sync_at: acc.last_sync_at
  }));
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"visao-geral" | "contas-ml" | "apps" | "jornada">("visao-geral");
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [fullStock, setFullStock] = useState<MLFullStock[]>([]);
  const [campaigns, setCampaigns] = useState<MLCampaign[]>([]);
  const [adsMetrics, setAdsMetrics] = useState<AdsMetrics | null>(null);
  const [shippingStats, setShippingStats] = useState<ShippingStats | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
  const [selectedJourneyTemplateId, setSelectedJourneyTemplateId] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  
  const loading = loadingStudent || loadingAccounts || loadingApps || loadingJourneys;
  
  // Hook para dados da conta selecionada
  const { data: accountData } = useMLAccountData(selectedAccountId || null, studentId || null);
  
  // Hook para métricas consolidadas
  const accountIds = mlAccounts.map(acc => acc.id);
  const { data: consolidatedMetricsData } = useConsolidatedAccountMetrics(accountIds, studentId || null);

  useEffect(() => {
    if (userRole !== 'manager' && userRole !== 'administrator') {
      navigate('/auth');
      return;
    }

    // Selecionar primeira conta automaticamente
    if (mlAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(mlAccounts[0].id);
    }

    // Selecionar primeira jornada automaticamente
    if (journeysData.length > 0 && !selectedJourneyId) {
      setSelectedJourneyId(journeysData[0].id);
      
      // Selecionar template padrão ou o primeiro
      const defaultTemplate = journeyTemplatesData.find(t => t.is_default) || journeyTemplatesData[0];
      if (defaultTemplate) {
        setSelectedJourneyTemplateId(defaultTemplate.id);
        // Carregar milestones (ainda precisa implementar)
      }
    }
  }, [userRole, mlAccounts, journeysData, journeyTemplatesData]);

  useEffect(() => {
    if (accountData) {
      // Converter MLMetrics do hook para MLMetrics local (com campos opcionais)
      if (accountData.metrics) {
        const metricsData = accountData.metrics as any;
        setMetrics({
          total_sales: metricsData.total_sales || 0,
          total_revenue: metricsData.total_revenue || 0,
          average_ticket: metricsData.average_ticket || 0,
          active_listings: metricsData.active_listings || 0,
          paused_listings: metricsData.paused_listings || 0,
          total_listings: metricsData.total_listings || 0,
          reputation_color: metricsData.reputation_color || 'grey',
          reputation_level: metricsData.reputation_level || null,
          reputation_transactions_total: metricsData.reputation_transactions_total || 0,
          positive_ratings_rate: metricsData.positive_ratings_rate || 0,
          has_decola: metricsData.has_decola || false,
          real_reputation_level: metricsData.real_reputation_level || null,
          protection_end_date: metricsData.protection_end_date || null,
          decola_problems_count: metricsData.decola_problems_count || 0,
          has_full: metricsData.has_full || false,
          is_mercado_lider: metricsData.is_mercado_lider || false,
          mercado_lider_level: metricsData.mercado_lider_level || null,
          claims_rate: metricsData.claims_rate || 0,
          claims_value: metricsData.claims_value || 0,
          delayed_handling_rate: metricsData.delayed_handling_rate || 0,
          delayed_handling_value: metricsData.delayed_handling_value || 0,
          cancellations_rate: metricsData.cancellations_rate || 0,
          cancellations_value: metricsData.cancellations_value || 0,
          negative_ratings_rate: metricsData.negative_ratings_rate || 0,
          neutral_ratings_rate: metricsData.neutral_ratings_rate || 0,
        } as MLMetrics);
      }
      setProducts(accountData.products || []);
      setFullStock(accountData.stock || []);
      setCampaigns(accountData.campaigns || []);
      
      // Calcular shipping stats dos produtos da conta
      if (accountData.products && accountData.products.length > 0) {
        const stats = calculateShippingStats(accountData.products);
        setShippingStats(stats);
      } else {
        setShippingStats(null);
      }
      
      if (accountData.campaigns) {
        const calculatedAdsMetrics = convertToAdsMetrics(calculateAdsMetrics(accountData.campaigns));
        setAdsMetrics(calculatedAdsMetrics);
      }
    }
  }, [accountData]);

  // Funções antigas removidas - agora usando hooks do React Query

  // Função auxiliar para converter ProductAdsMetrics para AdsMetrics (formato local)
  const convertToAdsMetrics = (productAdsMetrics: ReturnType<typeof calculateAdsMetrics>): AdsMetrics => {
    return {
      totalSpend: productAdsMetrics.totalSpend,
      totalRevenue: productAdsMetrics.totalRevenue,
      totalAcos: productAdsMetrics.acos,
      totalRoas: productAdsMetrics.roas,
      totalProductsInAds: productAdsMetrics.totalProductsInAds || 0,
      activeCampaigns: productAdsMetrics.activeCampaigns || 0
    };
  };

  // Funções loadAccountData e loadAvailableApps removidas - agora usando hooks do React Query

  const addAppToStudent = async () => {
    if (!selectedAppId || !studentId) return;
    
    const { error } = await supabase
      .from('student_apps')
      .insert({ student_id: studentId, app_id: selectedAppId });
    
    if (error) {
      toast({ 
        title: "Erro ao adicionar app", 
        description: error.message,
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: "App adicionado com sucesso!" });
    // Invalidar queries para recarregar dados
    queryClient.invalidateQueries({ queryKey: ['student-apps', studentId] });
    setIsAddingApp(false);
    setSelectedAppId("");
  };

  const removeAppFromStudent = async (studentAppId: string) => {
    const { error } = await supabase
      .from('student_apps')
      .delete()
      .eq('id', studentAppId);
    
    if (error) {
      toast({ 
        title: "Erro ao remover app", 
        description: error.message,
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: "App removido com sucesso!" });
    // Invalidar queries para recarregar dados
    if (studentId) {
      queryClient.invalidateQueries({ queryKey: ['student-apps', studentId] });
    }
  };

  const updateMilestoneStatus = async (milestoneId: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    
    if (newStatus === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const { error } = await supabase
      .from('milestones')
      .update(updateData)
      .eq('id', milestoneId);
    
    if (error) {
      toast({ 
        title: "Erro ao atualizar etapa", 
        description: error.message,
        variant: "destructive" 
      });
      return;
    }
    
    toast({ title: "Etapa atualizada com sucesso!" });
    // Recarregar milestones manualmente após atualização
    if (selectedJourneyId && selectedJourneyTemplateId) {
      loadMilestonesByTemplate(selectedJourneyId, selectedJourneyTemplateId);
    }
  };

  // Função loadJourneyMilestones removida - usando loadMilestonesByTemplate diretamente

  const getColorNameInPortuguese = (colorCode: string): string => {
    const colorMap: { [key: string]: string } = {
      'green': 'Verde',
      'yellow': 'Amarelo',
      'orange': 'Laranja',
      'red': 'Vermelho',
      'light_green': 'Verde Claro',
    };
    return colorMap[colorCode] || colorCode;
  };

  const getMercadoLivreStoreUrl = (nickname: string): string => {
    return `https://www.mercadolivre.com.br/perfil/${nickname}`;
  };

  const syncMLAccount = async () => {
    if (!selectedAccountId) return;
    
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('ml-sync-data', {
        body: { ml_account_id: selectedAccountId }
      });

      if (error) throw error;

      toast({
        title: "Sincronização concluída!",
        description: "Os dados da conta foram atualizados com sucesso.",
      });

      // Invalidar queries relacionadas para recarregar dados
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: ['ml-account-data', selectedAccountId, studentId] });
        queryClient.invalidateQueries({ queryKey: ['consolidated-account-metrics', accountIds, studentId] });
        queryClient.invalidateQueries({ queryKey: ['student-ml-accounts', studentId] });
      }
    } catch (error: any) {
      console.error('Error syncing ML account:', error);
      toast({
        title: "Erro ao sincronizar",
        description: error.message || "Não foi possível sincronizar a conta.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSetPrimaryAccount = async (accountId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('mercado_livre_accounts')
        .update({ is_primary: false })
        .eq('student_id', studentId);

      if (updateError) throw updateError;

      const { error: setPrimaryError } = await supabase
        .from('mercado_livre_accounts')
        .update({ is_primary: true })
        .eq('id', accountId);

      if (setPrimaryError) throw setPrimaryError;

      toast({ title: "Conta principal atualizada" });
      // Invalidar queries para recarregar dados
      if (studentId) {
        queryClient.invalidateQueries({ queryKey: ['student-ml-accounts', studentId] });
      }
    } catch (error) {
      console.error('Error setting primary account:', error);
      toast({ title: "Erro ao atualizar conta principal", variant: "destructive" });
    }
  };

  // Função loadBonusDeliveries removida - usando hook useStudentBonusDeliveries do React Query

  const loadMilestonesByTemplate = async (journeyId: string, templateId: string) => {
    try {
      console.log('Loading milestones for journey:', journeyId, 'template:', templateId);
      
      const { data: mtemps, error: mtError } = await supabase
        .from('milestone_templates')
        .select('id')
        .eq('journey_template_id', templateId);

      if (mtError) throw mtError;
      console.log('Milestone templates found:', mtemps);
      
      const templateIds = (mtemps || []).map(t => t.id);
      
      // Buscar milestones que têm template_id OU que pertencem a este journey
      // (pois alguns podem não ter template_id preenchido)
      let query = supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyId);
      
      if (templateIds.length > 0) {
        query = query.or(`template_id.in.(${templateIds.join(',')}),template_id.is.null`);
      }
      
      const { data: milestonesData, error: mError } = await query.order('order_index');

      if (mError) throw mError;
      console.log('Milestones found:', milestonesData);
      setMilestones(milestonesData || []);
    } catch (error: any) {
      console.error('Error loading milestones by template:', error);
      setMilestones([]);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background w-full">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando dados do aluno...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex min-h-screen bg-background w-full">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg text-muted-foreground mb-4">Aluno não encontrado</p>
            <Button onClick={() => navigate('/gestor/alunos')}>
              Voltar para Alunos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lowQualityProducts = products.filter(p => p.health?.health_level === 'critical' || (p.health?.health_score || 0) < 40);
  const noDescriptionProducts = products.filter(p => !p.has_description);
  const noTaxDataProducts = products.filter(p => !p.has_tax_data);

  const totalStockUnits = fullStock.reduce((sum, item) => 
    sum + (item.available_quantity || 0) + (item.reserved_quantity || 0), 0
  );

  // Cálculos financeiros do FULL
  const calculateFullStockFinancials = () => {
    const totalUnits = fullStock.reduce((sum, item) => 
      sum + (item.available_quantity || 0), 0
    );
    
    const totalRevenue = fullStock.reduce((sum, item) => {
      // Encontrar o produto correspondente pelo ml_item_id
      const product = products.find(p => p.ml_item_id === item.ml_item_id);
      const price = product?.price || 0;
      const units = item.available_quantity || 0;
      return sum + (units * price);
    }, 0);
    
    const payout = totalRevenue * 0.78; // 22% de taxas (14% ML + 8% frete)
    
    return {
      totalUnits,
      totalRevenue,
      payout
    };
  };

  const fullFinancials = metrics?.has_full ? calculateFullStockFinancials() : null;

  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar />
      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/gestor/alunos')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">{student.full_name}</h1>
                <p className="text-muted-foreground">{student.email}</p>
              </div>
            </div>
            <Badge variant={(student as any).mentoria_status === 'Ativo' ? 'default' : 'secondary'}>
              {(student as any).mentoria_status || 'Não definido'}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="visao-geral">
                <Home className="w-4 h-4 mr-2" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="contas-ml">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Contas ML
              </TabsTrigger>
              <TabsTrigger value="jornada">
                <TrendingUp className="w-4 h-4 mr-2" />
                Jornada
              </TabsTrigger>
            </TabsList>

            {/* TAB: VISÃO GERAL */}
            <TabsContent value="visao-geral" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Informações Pessoais */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Informações Pessoais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{student.email}</span>
                    </div>
                    {(student as any).phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{(student as any).phone}</span>
                      </div>
                    )}
                    {(student as any).estado && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{(student as any).estado}</span>
                      </div>
                    )}
                    {(student as any).turma && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>Turma: {(student as any).turma}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Estrutura e Financeiro */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Estrutura
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Estrutura</p>
                      <p className="font-medium">{(student as any).estrutura_vendedor || 'Não informado'}</p>
                    </div>
                    {(student as any).tipo_pj && (
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo PJ</p>
                        <p className="font-medium">{(student as any).tipo_pj}</p>
                      </div>
                    )}
                    {(student as any).cnpj && (
                      <div>
                        <p className="text-sm text-muted-foreground">CNPJ</p>
                        <p className="font-medium">{(student as any).cnpj}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Contador</p>
                      <p className="font-medium">{(student as any).possui_contador ? 'Sim' : 'Não'}</p>
                    </div>
                    {(student as any).caixa !== null && (student as any).caixa !== undefined && (
                      <div>
                        <p className="text-sm text-muted-foreground">Caixa</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format((student as any).caixa)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Resumo de Performance ML */}
              {consolidatedMetricsData && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Mercado Livre</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{consolidatedMetricsData.total_sales}</div>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(consolidatedMetricsData.total_revenue)}
                        </div>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(consolidatedMetricsData.average_ticket)}
                        </div>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Bônus do Plano */}
              <PlanBonusCard
                studentId={studentId || ''}
                bonusDeliveries={bonusDeliveriesData as any}
                isManager={true}
                onUpdate={() => {
                  // Invalidar queries para recarregar dados de bônus
                  if (studentId) {
                    queryClient.invalidateQueries({ queryKey: ['student-bonus-deliveries', studentId] });
                  }
                }}
              />
            </TabsContent>

            {/* TAB: CONTAS MERCADO LIVRE */}
            <TabsContent value="contas-ml" className="space-y-6">
              {mlAccounts.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ShoppingCart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma conta conectada</h3>
                    <p className="text-muted-foreground">
                      Este aluno ainda não conectou nenhuma conta do Mercado Livre
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Selector de Conta */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Contas do Mercado Livre</h3>
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

                  {/* Layout: Status da Conta + Métricas */}
                  {selectedAccountId && (
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
                              onClick={syncMLAccount}
                              disabled={isSyncing}
                              className="h-8 gap-1"
                            >
                              <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                            </Button>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {(() => {
                              const account = mlAccounts.find(a => a.id === selectedAccountId);
                              return account ? (
                                  <>
                                   <div className="space-y-2">
                                     <div className="flex items-center justify-between">
                                       <span className="text-sm text-muted-foreground">Nome da Conta</span>
                                       <a 
                                         href={getMercadoLivreStoreUrl(account.ml_nickname)}
                                         target="_blank"
                                         rel="noopener noreferrer"
                                         className="font-medium text-primary hover:underline flex items-center gap-1"
                                       >
                                         @{account.ml_nickname}
                                         <ExternalLink className="h-3 w-3" />
                                       </a>
                                     </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-muted-foreground">Status</span>
                                      <Badge variant={account.is_active ? "default" : "secondary"}>
                                        {account.is_active ? "Ativa" : "Inativa"}
                                      </Badge>
                                    </div>
                                     <div className="flex items-center justify-between">
                                       <span className="text-sm text-muted-foreground">Conta Principal</span>
                                       <Button
                                         size="sm"
                                         variant="ghost"
                                         onClick={() => handleSetPrimaryAccount(account.id)}
                                         className="h-7 w-7 p-0"
                                       >
                                         <Star className={`w-4 h-4 ${account.is_primary ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                                       </Button>
                                     </div>
                                    {account.last_sync_at && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Última Sincronização</span>
                                        <span className="font-medium text-sm">
                                          {new Date(account.last_sync_at).toLocaleString('pt-BR')}
                                        </span>
                                      </div>
                                    )}
                                   </div>
                                 </>
                               ) : null;
                             })()}
                          </CardContent>
                        </Card>

                        {/* Reputação */}
                        <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium">Reputação</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {metrics && (
                              <ReputationBadge
                                color={metrics.reputation_color}
                                levelId={metrics.reputation_level}
                                positiveRate={metrics.positive_ratings_rate}
                                totalTransactions={metrics.reputation_transactions_total}
                              />
                            )}
                          </CardContent>
                        </Card>
                      </div>

                        {/* Coluna 2: Métricas - 20% */}
                        {metrics && (
                          <div className="flex-[0.20] flex flex-col gap-3">
                            <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-emerald-600" />
                                  Vendas Totais
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-xl font-bold">{metrics.total_sales}</div>
                                <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                              </CardContent>
                            </Card>

                            <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-blue-600" />
                                  Faturamento
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-xl font-bold">
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  }).format(metrics.total_revenue)}
                                </div>
                                <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                              </CardContent>
                            </Card>

                            <Card className="border border-border hover:shadow-lg transition-shadow duration-300 flex-1">
                              <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-semibold flex items-center gap-1">
                                  <ShoppingCart className="w-3 h-3 text-violet-600" />
                                  Ticket Médio
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-xl font-bold">
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                  }).format(metrics.average_ticket)}
                                </div>
                                <p className="text-[10px] text-muted-foreground">Últimos 30 dias</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}

                        {/* Coluna 3: Apps e Extensões - 30% */}
                        <Card className="flex-[0.30] border border-border hover:shadow-lg transition-shadow duration-300">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                <Package className="w-4 h-4 text-violet-600" />
                                Apps e Extensões
                              </CardTitle>
                              <Button 
                                onClick={() => setIsAddingApp(true)} 
                                size="sm" 
                                variant="outline"
                                className="h-7 text-xs hover:scale-105 transition-transform"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Adicionar
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {studentAppsData.length === 0 ? (
                              <div className="text-center py-6">
                                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">Nenhum app associado</p>
                              </div>
                            ) : (
                              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {studentAppsData.map(app => (
                                  <div
                                    key={app.id}
                                    className="p-2 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors"
                                    style={{ borderColor: app.color }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-6 h-6 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: app.color }}
                                      />
                                      <span className="text-sm font-medium truncate">{app.name}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => app.student_app_id && removeAppFromStudent(app.student_app_id)}
                                      className="text-destructive hover:text-destructive h-7 w-7 p-0 hover:scale-110 transition-transform"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* Programas Especiais e Problemas */}
                      {metrics && (
                        <>

                          {/* Programas Especiais */}
                          <div className="grid md:grid-cols-3 gap-4">
                            {/* Decola */}
                            <Card className="transition-all duration-300 hover:shadow-lg border border-border">
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4" />
                                    Programa Decola
                                  </div>
                                  {metrics.has_decola && <Badge variant="default" className="text-xs">Ativo</Badge>}
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {metrics.has_decola ? (
                                  <div className="space-y-3">
                                    {metrics.real_reputation_level && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Reputação Real</span>
                                        <p className="text-sm font-medium">{getColorNameInPortuguese(metrics.real_reputation_level)}</p>
                                      </div>
                                    )}
                                    <div>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm">Problemas</span>
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
                                    </div>
                                    {metrics.protection_end_date && (
                                      <div>
                                        <span className="text-xs text-muted-foreground">Válido até</span>
                                        <p className="text-xs font-medium">
                                          {new Date(metrics.protection_end_date).toLocaleDateString('pt-BR')}
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
                            <Card className="transition-all duration-300 hover:shadow-lg border border-border">
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
                                    {/* Coluna Esquerda: Investimento e Produtos */}
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

                                    {/* Coluna Direita: ROAS e ACOS */}
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
                            <Card className="transition-all duration-300 hover:shadow-lg border border-border">
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
                                    
                                    {/* Layout em 2 colunas */}
                                    <div className="grid grid-cols-2 gap-4">
                                      {/* Coluna 1: Estoque */}
                                      <div>
                                        <div className="flex flex-col items-center justify-center h-full">
                                          <span className="text-xs text-muted-foreground mb-1">Estoque Total</span>
                                          <span className="text-2xl font-bold">{totalStockUnits}</span>
                                          <span className="text-xs text-muted-foreground">unidades</span>
                                        </div>
                                      </div>
                                      
                                      {/* Coluna 2: Financeiro */}
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

                          {/* Tipos de Envio */}
                          {shippingStats && (
                            <Card className="border border-border hover:shadow-lg transition-shadow duration-300">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                  <Package className="w-5 h-5 text-primary" />
                                  Tipos de Envio
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  Distribuição de anúncios por modalidade de envio - Conta @{mlAccounts.find(a => a.id === selectedAccountId)?.ml_nickname || 'N/A'}
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

                          {/* Problemas de Anúncios */}
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
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>


            {/* TAB: JORNADA */}
            <TabsContent value="jornada" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Jornada do Aluno</CardTitle>
                    {journeyTemplatesData.length > 0 && selectedJourneyId && (
                      <Select value={selectedJourneyTemplateId} onValueChange={(value) => {
                        setSelectedJourneyTemplateId(value);
                        loadMilestonesByTemplate(selectedJourneyId, value);
                      }}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Selecione a jornada" />
                        </SelectTrigger>
                        <SelectContent>
                          {journeyTemplatesData.map(tpl => (
                            <SelectItem key={tpl.id} value={tpl.id}>
                              {tpl.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {milestones.length === 0 ? (
                    <div className="text-center py-8">
                      <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhuma etapa cadastrada</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Agrupar por fase */}
                      {['Onboarding', 'Estrutura Inicial', 'Profissionalização'].map(phase => {
                        const phaseMilestones = milestones.filter(m => m.phase === phase);
                        if (phaseMilestones.length === 0) return null;

                        const completed = phaseMilestones.filter(m => m.status === 'completed').length;
                        const progress = (completed / phaseMilestones.length) * 100;

                        return (
                          <div key={phase} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-semibold">{phase}</h4>
                                <span className="text-sm text-muted-foreground">
                                  {completed}/{phaseMilestones.length} completas
                                </span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                            
                            <div className="space-y-2 pl-4">
                              {phaseMilestones.map(milestone => (
                                <div 
                                  key={milestone.id} 
                                  className="flex items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {milestone.status === 'completed' ? (
                                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                                    ) : milestone.status === 'in_progress' ? (
                                      <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                                    ) : (
                                      <XCircle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                      <p className="font-medium text-sm">{milestone.title}</p>
                                      {milestone.description && (
                                        <p className="text-xs text-muted-foreground">{milestone.description}</p>
                                      )}
                                    </div>
                                  </div>
                                  <Select 
                                    value={milestone.status} 
                                    onValueChange={(value) => updateMilestoneStatus(milestone.id, value)}
                                  >
                                    <SelectTrigger className="w-40">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="not_started">Não Iniciada</SelectItem>
                                      <SelectItem value="in_progress">Em Progresso</SelectItem>
                                      <SelectItem value="completed">Concluída</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog para Adicionar App */}
      <Dialog open={isAddingApp} onOpenChange={setIsAddingApp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar App/Extensão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAppId} onValueChange={setSelectedAppId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um app" />
              </SelectTrigger>
              <SelectContent>
                {availableAppsData
                  .filter(app => !studentAppsData.some(sa => sa.id === app.id))
                  .map(app => (
                    <SelectItem key={app.id} value={app.id}>
                      {app.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAddingApp(false)}>
                Cancelar
              </Button>
              <Button onClick={addAppToStudent} disabled={!selectedAppId}>
                Adicionar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
