import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
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
  ExternalLink, Home, Image, Plus, RefreshCw, Target
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface StudentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  turma: string;
  estado: string;
  estrutura_vendedor: string;
  tipo_pj: string | null;
  cnpj: string;
  possui_contador: boolean;
  caixa: number | null;
  hub_logistico: string;
  sistemas_externos: string;
  mentoria_status: string;
}

interface MLAccount {
  id: string;
  ml_nickname: string;
  ml_user_id: string;
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

interface MLProduct {
  id: string;
  ml_item_id: string;
  title: string;
  thumbnail: string;
  status: string;
  price: number;
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
}

interface MLCampaign {
  id: string;
  campaign_id: number;
  campaign_name: string;
  status: string;
  total_spend: number;
  ad_revenue: number;
  acos: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  products_count: number;
  advertised_sales: number;
}

interface AdsMetrics {
  totalSpend: number;
  totalRevenue: number;
  totalAcos: number;
  totalRoas: number;
  totalProductsInAds: number;
  activeCampaigns: number;
}

interface StudentApp {
  id: string;
  name: string;
  color: string;
  student_app_id?: string;
}

interface BonusDelivery {
  id: string;
  bonus_id: string;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by: string | null;
  notes: string | null;
  bonus: {
    name: string;
    description: string | null;
    cost: number;
  };
  deliveredByProfile?: {
    full_name: string;
  };
}

interface Milestone {
  id: string;
  title: string;
  description: string;
  status: string;
  phase: string;
  order_index: number;
}

export default function StudentDetails() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [mlAccounts, setMlAccounts] = useState<MLAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"visao-geral" | "contas-ml" | "apps" | "jornada">("visao-geral");
  const [metrics, setMetrics] = useState<MLMetrics | null>(null);
  const [consolidatedMetrics, setConsolidatedMetrics] = useState<MLMetrics | null>(null);
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [fullStock, setFullStock] = useState<MLFullStock[]>([]);
  const [campaigns, setCampaigns] = useState<MLCampaign[]>([]);
  const [adsMetrics, setAdsMetrics] = useState<AdsMetrics | null>(null);
  const [studentApps, setStudentApps] = useState<StudentApp[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [availableApps, setAvailableApps] = useState<any[]>([]);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [journeys, setJourneys] = useState<any[]>([]); // student_journeys rows (likely 1)
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(""); // student journey id
  const [journeyTemplates, setJourneyTemplates] = useState<any[]>([]); // templates list
  const [selectedJourneyTemplateId, setSelectedJourneyTemplateId] = useState<string>("");
  const [bonusDeliveries, setBonusDeliveries] = useState<BonusDelivery[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (userRole !== 'manager') {
      navigate('/auth');
      return;
    }

    if (studentId) {
      loadStudentData();
    }
  }, [studentId, userRole]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData(selectedAccountId);
    }
  }, [selectedAccountId]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      // Buscar perfil do aluno
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      if (profileError) throw profileError;
      setStudent(profileData);

      // Buscar contas ML do aluno
      const { data: accountsData, error: accountsError } = await supabase
        .from('mercado_livre_accounts')
        .select('id, ml_nickname, ml_user_id, is_primary, is_active, connected_at, last_sync_at')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (accountsError) throw accountsError;
      setMlAccounts(accountsData || []);

      if (accountsData && accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].id);
        // Carregar métricas consolidadas de todas as contas
        await loadConsolidatedMetrics(accountsData.map(a => a.id));
      }

      // Buscar apps do aluno
      const { data: appsData, error: appsError } = await supabase
        .from('student_apps')
        .select('id, apps_extensions(id, name, color)')
        .eq('student_id', studentId);

      if (appsError) throw appsError;
      const apps = appsData?.map(sa => ({
        student_app_id: sa.id,
        ...(sa.apps_extensions as any)
      })).filter(Boolean) || [];
      setStudentApps(apps as any);

      // Buscar jornada (id) do aluno e templates disponíveis
      const { data: journeysData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('id, current_phase, overall_progress')
        .eq('student_id', studentId);

      const { data: templatesData, error: templatesError } = await supabase
        .from('journey_templates')
        .select('id, name, is_default')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

      if (templatesError) throw templatesError;
      setJourneyTemplates(templatesData || []);

      if (!journeyError && journeysData && journeysData.length > 0) {
        setJourneys(journeysData);
        setSelectedJourneyId(journeysData[0].id);

        // Seleciona template padrão ou o primeiro
        const defaultTemplate = (templatesData || []).find(t => t.is_default) || (templatesData || [])[0];
        if (defaultTemplate) {
          setSelectedJourneyTemplateId(defaultTemplate.id);
          await loadMilestonesByTemplate(journeysData[0].id, defaultTemplate.id);
        } else {
          setMilestones([]);
        }
      } else {
        setJourneys([]);
        setMilestones([]);
      }

      // Buscar apps disponíveis
      await loadAvailableApps();
      
      // Buscar bônus do aluno
      await loadBonusDeliveries();
    } catch (error: any) {
      console.error('Error loading student data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadConsolidatedMetrics = async (accountIds: string[]) => {
    try {
      const { data: allMetrics } = await supabase
        .from('mercado_livre_metrics')
        .select('*')
        .eq('student_id', studentId)
        .in('ml_account_id', accountIds);

      if (allMetrics && allMetrics.length > 0) {
        const consolidated = allMetrics.reduce((acc, m) => ({
          total_sales: acc.total_sales + (m.total_sales || 0),
          total_revenue: acc.total_revenue + (m.total_revenue || 0),
          average_ticket: 0,
        }), { total_sales: 0, total_revenue: 0, average_ticket: 0 });

        consolidated.average_ticket = consolidated.total_sales > 0 
          ? consolidated.total_revenue / consolidated.total_sales 
          : 0;

        setConsolidatedMetrics(consolidated as any);
      }
    } catch (error: any) {
      console.error('Error loading consolidated metrics:', error);
    }
  };

  const calculateAdsMetrics = (campaignsData: MLCampaign[]): AdsMetrics => {
    if (!campaignsData || campaignsData.length === 0) {
      return {
        totalSpend: 0,
        totalRevenue: 0,
        totalAcos: 0,
        totalRoas: 0,
        totalProductsInAds: 0,
        activeCampaigns: 0
      };
    }

    const activeCampaigns = campaignsData.filter(c => 
      c.status === 'active' || c.status === 'enabled'
    );

    const totalSpend = activeCampaigns.reduce((sum, c) => sum + (c.total_spend || 0), 0);
    const totalRevenue = activeCampaigns.reduce((sum, c) => sum + (c.ad_revenue || 0), 0);
    const totalProductsInAds = activeCampaigns.reduce((sum, c) => sum + (c.products_count || 0), 0);

    return {
      totalSpend,
      totalRevenue,
      totalAcos: totalRevenue > 0 ? (totalSpend / totalRevenue) * 100 : 0,
      totalRoas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      totalProductsInAds,
      activeCampaigns: activeCampaigns.length
    };
  };

  const loadAccountData = async (accountId: string) => {
    try {
      const [metricsResult, productsResult, stockResult, campaignsResult] = await Promise.all([
        supabase
          .from('mercado_livre_metrics')
          .select('*')
          .eq('ml_account_id', accountId)
          .eq('student_id', studentId)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle(),
        
        supabase
          .from('mercado_livre_products')
          .select('*')
          .eq('ml_account_id', accountId)
          .eq('student_id', studentId),
        
        supabase
          .from('mercado_livre_full_stock')
          .select('*')
          .eq('ml_account_id', accountId)
          .eq('student_id', studentId),
        
        supabase
          .from('mercado_livre_campaigns')
          .select('*')
          .eq('ml_account_id', accountId)
          .eq('student_id', studentId)
          .order('synced_at', { ascending: false })
      ]);

      setMetrics(metricsResult.data);
      setProducts(productsResult.data || []);
      setFullStock(stockResult.data || []);
      setCampaigns(campaignsResult.data || []);
      
      if (campaignsResult.data) {
        const calculatedAdsMetrics = calculateAdsMetrics(campaignsResult.data);
        setAdsMetrics(calculatedAdsMetrics);
      }
    } catch (error: any) {
      console.error('Error loading account data:', error);
    }
  };

  const loadAvailableApps = async () => {
    try {
      const { data } = await supabase
        .from('apps_extensions')
        .select('*')
        .order('name');
      setAvailableApps(data || []);
    } catch (error: any) {
      console.error('Error loading available apps:', error);
    }
  };

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
    loadStudentData();
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
    loadStudentData();
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
    loadStudentData();
  };

  const loadJourneyMilestones = async (journeyId: string) => {
    try {
      const { data: milestonesData } = await supabase
        .from('milestones')
        .select('*')
        .eq('journey_id', journeyId)
        .order('order_index');

      setMilestones(milestonesData || []);
    } catch (error: any) {
      console.error('Error loading milestones:', error);
    }
  };

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

      // Recarregar dados da conta
      await loadAccountData(selectedAccountId);
      await loadStudentData();
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

  const loadBonusDeliveries = async () => {
    if (!studentId) return;
    
    try {
      const { data, error } = await supabase
        .from('student_bonus_delivery')
        .select(`
          id,
          bonus_id,
          delivered,
          delivered_at,
          delivered_by,
          notes,
          bonus:bonus_id (
            name,
            description,
            cost
          ),
          deliveredByProfile:profiles!delivered_by (
            full_name
          )
        `)
        .eq('student_id', studentId)
        .order('delivered', { ascending: true });

      if (error) throw error;
      setBonusDeliveries(data as BonusDelivery[]);
    } catch (error: any) {
      console.error('Error loading bonus deliveries:', error);
    }
  };

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

  const lowQualityProducts = products.filter(p => p.has_low_quality_photos);
  const noDescriptionProducts = products.filter(p => !p.has_description);
  const noTaxDataProducts = products.filter(p => !p.has_tax_data);

  const totalStockUnits = fullStock.reduce((sum, item) => 
    sum + item.available_units + item.reserved_units + item.inbound_units, 0
  );

  // Cálculos financeiros do FULL
  const calculateFullStockFinancials = () => {
    const totalUnits = fullStock.reduce((sum, item) => 
      sum + (item.available_units || 0), 0
    );
    
    const totalRevenue = fullStock.reduce((sum, item) => {
      // Encontrar o produto correspondente pelo ml_item_id
      const product = products.find(p => p.ml_item_id === item.ml_item_id);
      const price = product?.price || 0;
      const units = item.available_units || 0;
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
            <Badge variant={student.mentoria_status === 'Ativo' ? 'default' : 'secondary'}>
              {student.mentoria_status}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="visao-geral">
                <Home className="w-4 h-4 mr-2" />
                Visão Geral
              </TabsTrigger>
              <TabsTrigger value="contas-ml">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Contas ML
              </TabsTrigger>
              <TabsTrigger value="apps">
                <Package className="w-4 h-4 mr-2" />
                Apps
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
                    {student.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{student.phone}</span>
                      </div>
                    )}
                    {student.estado && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{student.estado}</span>
                      </div>
                    )}
                    {student.turma && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <span>Turma: {student.turma}</span>
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
                      <p className="font-medium">{student.estrutura_vendedor}</p>
                    </div>
                    {student.tipo_pj && (
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo PJ</p>
                        <p className="font-medium">{student.tipo_pj}</p>
                      </div>
                    )}
                    {student.cnpj && (
                      <div>
                        <p className="text-sm text-muted-foreground">CNPJ</p>
                        <p className="font-medium">{student.cnpj}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Contador</p>
                      <p className="font-medium">{student.possui_contador ? 'Sim' : 'Não'}</p>
                    </div>
                    {student.caixa !== null && (
                      <div>
                        <p className="text-sm text-muted-foreground">Caixa</p>
                        <p className="font-medium">
                          {new Intl.NumberFormat('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          }).format(student.caixa)}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Resumo de Performance ML */}
              {consolidatedMetrics && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Mercado Livre</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{consolidatedMetrics.total_sales}</div>
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
                          }).format(consolidatedMetrics.total_revenue)}
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
                          }).format(consolidatedMetrics.average_ticket)}
                        </div>
                        <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Bônus do Plano */}
              <PlanBonusCard
                studentId={studentId}
                bonusDeliveries={bonusDeliveries}
                isManager={true}
                onUpdate={loadBonusDeliveries}
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
                      <div className="grid md:grid-cols-2 gap-4">
                        {/* Coluna 1: Status da Conta */}
                        <Card>
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
                                      <span className="font-medium">{account.is_primary ? "Sim" : "Não"}</span>
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

                                  {/* Reputação */}
                                  {metrics && (
                                    <div className="pt-4 border-t space-y-3">
                                      <h4 className="font-semibold">Reputação</h4>
                                      <ReputationBadge
                                        color={metrics.reputation_color}
                                        levelId={metrics.reputation_level}
                                        positiveRate={metrics.positive_ratings_rate}
                                        totalTransactions={metrics.reputation_transactions_total}
                                      />
                                    </div>
                                  )}
                                </>
                              ) : null;
                            })()}
                          </CardContent>
                        </Card>

                        {/* Coluna 2: Métricas */}
                        {metrics && (
                          <div className="grid gap-4">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Vendas Totais
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">{metrics.total_sales}</div>
                                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
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
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL',
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0
                                  }).format(metrics.total_revenue)}
                                </div>
                                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                  <ShoppingCart className="w-4 h-4" />
                                  Ticket Médio
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">
                                  {new Intl.NumberFormat('pt-BR', { 
                                    style: 'currency', 
                                    currency: 'BRL' 
                                  }).format(metrics.average_ticket)}
                                </div>
                                <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </div>

                      {/* Programas Especiais e Problemas */}
                      {metrics && (
                        <>

                          {/* Programas Especiais */}
                          <div className="grid md:grid-cols-3 gap-4">
                            {/* Decola */}
                            <Card className={metrics.has_decola ? "bg-muted/50" : ""}>
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
                            <Card className={adsMetrics && adsMetrics.activeCampaigns > 0 ? "bg-muted/50" : ""}>
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
                            <Card className={metrics.has_full ? "bg-muted/50" : ""}>
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

                          {/* Problemas de Anúncios */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" />
                                Problemas de Qualidade
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <Image className="w-4 h-4 text-red-500" />
                                  <span className="text-sm">Fotos Baixa Qualidade</span>
                                </div>
                                <span className="font-bold text-red-500">
                                  {lowQualityProducts.length} anúncios
                                </span>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="w-4 h-4 text-orange-500" />
                                  <span className="text-sm">Sem Descrição</span>
                                </div>
                                <span className="font-bold text-orange-500">
                                  {noDescriptionProducts.length} anúncios
                                </span>
                              </div>

                              <div className="flex items-center justify-between p-3 bg-muted/50 rounded">
                                <div className="flex items-center gap-2">
                                  <ExternalLink className="w-4 h-4 text-yellow-500" />
                                  <span className="text-sm">Sem Dados Fiscais</span>
                                </div>
                                <span className="font-bold text-yellow-500">
                                  {noTaxDataProducts.length} anúncios
                                </span>
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

            {/* TAB: APPS */}
            <TabsContent value="apps" className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Apps e Extensões</CardTitle>
                  <Button onClick={() => setIsAddingApp(true)} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar App
                  </Button>
                </CardHeader>
                <CardContent>
                  {studentApps.length === 0 ? (
                    <div className="text-center py-8">
                      <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">Nenhum app associado</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {studentApps.map(app => (
                        <div
                          key={app.id}
                          className="p-4 border rounded-lg flex items-center justify-between"
                          style={{ borderColor: app.color }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full"
                              style={{ backgroundColor: app.color }}
                            />
                            <span className="font-medium">{app.name}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => app.student_app_id && removeAppFromStudent(app.student_app_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: JORNADA */}
            <TabsContent value="jornada" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Jornada do Aluno</CardTitle>
                    {journeyTemplates.length > 0 && selectedJourneyId && (
                      <Select value={selectedJourneyTemplateId} onValueChange={(value) => {
                        setSelectedJourneyTemplateId(value);
                        loadMilestonesByTemplate(selectedJourneyId, value);
                      }}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="Selecione a jornada" />
                        </SelectTrigger>
                        <SelectContent>
                          {journeyTemplates.map(tpl => (
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
                {availableApps
                  .filter(app => !studentApps.some(sa => sa.id === app.id))
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
