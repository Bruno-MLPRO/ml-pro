import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { useStudentProfile, useStudentMLAccounts, useStudentApps, useStudentJourneys, useJourneyTemplates, useAvailableApps, useStudentBonusDeliveries, useConsolidatedAccountMetrics } from "@/hooks/queries/useStudentData";
import { useMLAccountData } from "@/hooks/queries/useMLAccountData";
import { calculateAdsMetrics, calculateShippingStats } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, TrendingUp, ShoppingCart, Home
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StudentProfileSection } from "@/components/student/StudentProfileSection";
import { StudentMLAccountsSection } from "@/components/student/StudentMLAccountsSection";
import { StudentJourneySection } from "@/components/student/StudentJourneySection";
import { StudentAppsSection } from "@/components/student/StudentAppsSection";
import type { MLAccount, MLProduct, MLFullStock, MLCampaign, AdsMetrics, MLSellerRecovery } from "@/types/mercadoLivre";
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
  const [sellerRecovery, setSellerRecovery] = useState<MLSellerRecovery | null>(null);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>("");
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
    }
  }, [userRole, mlAccounts, journeysData, navigate, selectedAccountId, selectedJourneyId]);

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
      setSellerRecovery(accountData.sellerRecovery || null);
      
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
              <StudentProfileSection
                student={student}
                studentId={studentId || ''}
                bonusDeliveries={bonusDeliveriesData as any}
                consolidatedMetrics={consolidatedMetricsData}
                onUpdateBonus={() => {
                  if (studentId) {
                    queryClient.invalidateQueries({ queryKey: ['student-bonus-deliveries', studentId] });
                  }
                }}
                appsSection={
                  <StudentAppsSection
                    studentId={studentId || ''}
                    studentApps={studentAppsData}
                    availableApps={availableAppsData}
                  />
                }
              />
            </TabsContent>

            {/* TAB: CONTAS MERCADO LIVRE */}
            <TabsContent value="contas-ml" className="space-y-6">
              <StudentMLAccountsSection
                mlAccounts={mlAccounts}
                selectedAccountId={selectedAccountId}
                onAccountChange={setSelectedAccountId}
                metrics={metrics}
                products={products}
                fullStock={fullStock}
                campaigns={campaigns}
                adsMetrics={adsMetrics}
                shippingStats={shippingStats}
                sellerRecovery={sellerRecovery}
                isSyncing={isSyncing}
                onSync={syncMLAccount}
                onSetPrimaryAccount={handleSetPrimaryAccount}
                studentId={studentId || undefined}
              />
            </TabsContent>

            {/* TAB: JORNADA */}
            <TabsContent value="jornada" className="space-y-6">
              <StudentJourneySection
                studentId={studentId || ''}
                journeyId={selectedJourneyId || null}
                journeyTemplates={journeyTemplatesData.map(t => ({
                  ...t,
                  description: (t as any).description || ''
                }))}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
