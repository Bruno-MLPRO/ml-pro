import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ReputationBadge } from "@/components/ReputationBadge";
import { 
  ArrowLeft, User, Phone, Mail, MapPin, Building2, DollarSign, Package, 
  TrendingUp, ShoppingCart, Award, CheckCircle2, XCircle, AlertTriangle,
  ExternalLink, Home, Image
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
}

interface StudentApp {
  id: string;
  name: string;
  color: string;
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
  const [products, setProducts] = useState<MLProduct[]>([]);
  const [fullStock, setFullStock] = useState<MLFullStock[]>([]);
  const [studentApps, setStudentApps] = useState<StudentApp[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

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
        .select('*')
        .eq('student_id', studentId)
        .eq('is_active', true)
        .order('is_primary', { ascending: false });

      if (accountsError) throw accountsError;
      setMlAccounts(accountsData || []);

      if (accountsData && accountsData.length > 0) {
        setSelectedAccountId(accountsData[0].id);
      }

      // Buscar apps do aluno
      const { data: appsData, error: appsError } = await supabase
        .from('student_apps')
        .select('apps_extensions(id, name, color)')
        .eq('student_id', studentId);

      if (appsError) throw appsError;
      const apps = appsData?.map(sa => sa.apps_extensions).flat().filter(Boolean) || [];
      setStudentApps(apps as StudentApp[]);

      // Buscar jornada e etapas
      const { data: journeyData, error: journeyError } = await supabase
        .from('student_journeys')
        .select('id')
        .eq('student_id', studentId)
        .single();

      if (!journeyError && journeyData) {
        const { data: milestonesData } = await supabase
          .from('milestones')
          .select('*')
          .eq('journey_id', journeyData.id)
          .order('order_index');

        setMilestones(milestonesData || []);
      }
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

  const loadAccountData = async (accountId: string) => {
    try {
      const [metricsResult, productsResult, stockResult] = await Promise.all([
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
          .eq('student_id', studentId)
      ]);

      setMetrics(metricsResult.data);
      setProducts(productsResult.data || []);
      setFullStock(stockResult.data || []);
    } catch (error: any) {
      console.error('Error loading account data:', error);
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
              {metrics && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Performance Mercado Livre</h3>
                  <div className="grid md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Vendas Totais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.total_sales}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
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
                          }).format(metrics.average_ticket)}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Anúncios</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metrics.total_listings}</div>
                        <p className="text-sm text-muted-foreground">
                          {metrics.active_listings} ativos
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
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

                  {/* Estado da Conta */}
                  {selectedAccountId && (
                    <>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm font-medium">Status da Conta</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {(() => {
                            const account = mlAccounts.find(a => a.id === selectedAccountId);
                            return account ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-muted-foreground">Nickname</span>
                                  <span className="font-medium">@{account.ml_nickname}</span>
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
                              </>
                            ) : null;
                          })()}
                        </CardContent>
                      </Card>

                      {/* Métricas */}
                      {metrics ? (
                        <>
                          <div className="grid md:grid-cols-3 gap-4">
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Vendas Totais
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                <div className="text-2xl font-bold">{metrics.total_sales}</div>
                              </CardContent>
                            </Card>

                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                  <DollarSign className="w-4 h-4" />
                                  Receita Total
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
                              </CardContent>
                            </Card>
                          </div>

                          {/* Reputação */}
                          <Card>
                            <CardHeader>
                              <CardTitle>Reputação</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <ReputationBadge
                                color={metrics.reputation_color}
                                levelId={metrics.reputation_level}
                                positiveRate={metrics.positive_ratings_rate}
                                totalTransactions={metrics.reputation_transactions_total}
                              />
                              <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Avaliações Positivas</p>
                                  <p className="text-lg font-bold">{metrics.positive_ratings_rate.toFixed(1)}%</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Total de Transações</p>
                                  <p className="text-lg font-bold">{metrics.reputation_transactions_total}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Programas Especiais */}
                          <div className="grid md:grid-cols-2 gap-4">
                            {/* Decola */}
                            <Card className={metrics.has_decola ? "bg-muted/50" : ""}>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Award className="w-4 h-4" />
                                  Programa Decola
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {metrics.has_decola ? (
                                  <div className="space-y-3">
                                    <Badge variant="default" className="mb-2">Ativo</Badge>
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
                                      <p className="text-xs text-muted-foreground">
                                        Válido até: {new Date(metrics.protection_end_date).toLocaleDateString('pt-BR')}
                                      </p>
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

                            {/* FULL */}
                            <Card className={metrics.has_full ? "bg-muted/50" : ""}>
                              <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                  <Package className="w-4 h-4" />
                                  Mercado Livre FULL
                                </CardTitle>
                              </CardHeader>
                              <CardContent>
                                {metrics.has_full ? (
                                  <div className="space-y-3">
                                    <Badge variant="default" className="mb-2">Ativo</Badge>
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Estoque Total</span>
                                        <span className="font-bold">{totalStockUnits} un</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Disponível</span>
                                        <span className="font-medium">
                                          {fullStock.reduce((sum, item) => sum + item.available_units, 0)} un
                                        </span>
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
                      ) : (
                        <Card>
                          <CardContent className="p-8 text-center">
                            <p className="text-muted-foreground">Nenhuma métrica disponível para esta conta</p>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </>
              )}
            </TabsContent>

            {/* TAB: APPS */}
            <TabsContent value="apps" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Apps e Extensões</CardTitle>
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
                          className="p-4 border rounded-lg"
                          style={{ borderColor: app.color }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-full"
                              style={{ backgroundColor: app.color }}
                            />
                            <span className="font-medium">{app.name}</span>
                          </div>
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
                  <CardTitle>Jornada do Aluno</CardTitle>
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
                                <div key={milestone.id} className="flex items-start gap-3 p-3 bg-muted/50 rounded">
                                  {milestone.status === 'completed' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                                  ) : milestone.status === 'in_progress' ? (
                                    <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-medium">{milestone.title}</p>
                                    {milestone.description && (
                                      <p className="text-sm text-muted-foreground">{milestone.description}</p>
                                    )}
                                  </div>
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
    </div>
  );
}
