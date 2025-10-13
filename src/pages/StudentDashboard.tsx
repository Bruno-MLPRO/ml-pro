import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Calendar, Link as LinkIcon, TrendingUp, DollarSign, Package, CheckCircle2, ShoppingBag, Plus, Unplug, Star, Crown, Circle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  reputation_score: number;
  has_decola: boolean;
  has_full: boolean;
  is_mercado_lider: boolean;
  mercado_lider_level: string | null;
}

const StudentDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [callSchedules, setCallSchedules] = useState<CallSchedule[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [mlAccounts, setMlAccounts] = useState<MLAccount[]>([]);
  const [consolidatedMetrics, setConsolidatedMetrics] = useState<MLMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectingML, setConnectingML] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      loadDashboardData();
      loadMLAccounts();
      
      // Configurar realtime para atualizar métricas automaticamente
      const channel = supabase
        .channel('ml-metrics-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_metrics',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('ML metrics updated')
            loadMLAccounts()
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'mercado_livre_accounts',
            filter: `student_id=eq.${user.id}`
          },
          () => {
            console.log('ML accounts updated')
            loadMLAccounts()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [user, userRole, authLoading, navigate]);

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

  const loadMLAccounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ml-get-accounts')
      
      if (error) {
        console.error('Error loading ML accounts:', error)
        return
      }

      if (data?.accounts) {
        setMlAccounts(data.accounts)
        
        // Calcular métricas consolidadas
        if (data.accounts.length > 0) {
          const consolidated = data.accounts.reduce((acc: MLMetrics, account: MLAccount) => {
            if (!account.metrics) return acc
            
            return {
              total_sales: acc.total_sales + account.metrics.total_sales,
              total_revenue: acc.total_revenue + account.metrics.total_revenue,
              average_ticket: 0, // Será calculado depois
              active_listings: acc.active_listings + account.metrics.active_listings,
              reputation_level: account.metrics.reputation_level || acc.reputation_level,
              reputation_score: Math.max(acc.reputation_score, account.metrics.reputation_score),
              has_decola: acc.has_decola || account.metrics.has_decola,
              has_full: acc.has_full || account.metrics.has_full,
              is_mercado_lider: acc.is_mercado_lider || account.metrics.is_mercado_lider,
              mercado_lider_level: account.metrics.mercado_lider_level || acc.mercado_lider_level
            }
          }, {
            total_sales: 0,
            total_revenue: 0,
            average_ticket: 0,
            active_listings: 0,
            reputation_level: null,
            reputation_score: 0,
            has_decola: false,
            has_full: false,
            is_mercado_lider: false,
            mercado_lider_level: null
          })
          
          consolidated.average_ticket = consolidated.total_sales > 0 
            ? consolidated.total_revenue / consolidated.total_sales 
            : 0
          
          setConsolidatedMetrics(consolidated)
        }
      }
    } catch (error) {
      console.error('Error loading ML accounts:', error)
    }
  }

  const handleConnectML = async () => {
    setConnectingML(true)
    try {
      const { data, error } = await supabase.functions.invoke('ml-auth-start')
      
      if (error) {
        console.error('Error starting ML auth:', error)
        return
      }

      if (data?.authorization_url) {
        window.location.href = data.authorization_url
      }
    } catch (error) {
      console.error('Error connecting to ML:', error)
    } finally {
      setConnectingML(false)
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

          {/* Contas Mercado Livre */}
          <Card className="mb-6">
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
                        </div>
                        {account.is_primary && (
                          <Badge variant="default">Principal</Badge>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleDisconnect(account.id)}
                      >
                        <Unplug className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

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

          {/* Dashboard de Vendas */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <CardTitle>Desempenho - Últimos 30 Dias</CardTitle>
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
              {mlAccounts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-foreground-secondary">
                    Conecte uma conta do Mercado Livre para visualizar suas métricas
                  </p>
                </div>
              ) : (
                <>
                  {/* Métricas Principais */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-success" />
                        <span className="text-sm text-foreground-secondary">Faturamento</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {formatCurrency(consolidatedMetrics?.total_revenue || 0)}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {consolidatedMetrics?.total_sales || 0} vendas
                      </p>
                    </div>
                    
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-primary" />
                        <span className="text-sm text-foreground-secondary">Anúncios</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {consolidatedMetrics?.active_listings || 0}
                      </p>
                      <p className="text-xs text-foreground-secondary mt-1">
                        ativos
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
                    </div>
                    
                    <div className="p-6 rounded-lg border border-border bg-background-elevated">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-warning" />
                        <span className="text-sm text-foreground-secondary">Reputação</span>
                      </div>
                      <p className="text-3xl font-bold text-foreground">
                        {consolidatedMetrics?.reputation_score?.toFixed(1) || '0.0'}/5.0
                      </p>
                      {consolidatedMetrics?.reputation_level && (
                        <Badge 
                          variant={
                            consolidatedMetrics.reputation_level === 'green' ? 'default' :
                            consolidatedMetrics.reputation_level === 'yellow' ? 'secondary' : 'destructive'
                          }
                          className="text-xs mt-1"
                        >
                          {consolidatedMetrics.reputation_level === 'green' ? 'Excelente' :
                           consolidatedMetrics.reputation_level === 'yellow' ? 'Bom' : 'Atenção'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Status de Programas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className={`p-4 rounded-lg border ${consolidatedMetrics?.has_decola ? 'border-success bg-success/10' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        {consolidatedMetrics?.has_decola ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Circle className="w-5 h-5 text-foreground-secondary" />
                        )}
                        <span className="font-semibold">Decola</span>
                      </div>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {consolidatedMetrics?.has_decola ? 'Ativo' : 'Não ativado'}
                      </p>
                    </div>
                    
                    <div className={`p-4 rounded-lg border ${consolidatedMetrics?.has_full ? 'border-success bg-success/10' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        {consolidatedMetrics?.has_full ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Circle className="w-5 h-5 text-foreground-secondary" />
                        )}
                        <span className="font-semibold">FULL</span>
                      </div>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {consolidatedMetrics?.has_full ? 'Ativo' : 'Não ativado'}
                      </p>
                    </div>
                    
                    <div className={`p-4 rounded-lg border ${consolidatedMetrics?.is_mercado_lider ? 'border-warning bg-warning/10' : 'border-border'}`}>
                      <div className="flex items-center gap-2">
                        {consolidatedMetrics?.is_mercado_lider ? (
                          <Crown className="w-5 h-5 text-warning" />
                        ) : (
                          <Circle className="w-5 h-5 text-foreground-secondary" />
                        )}
                        <span className="font-semibold">Mercado Líder</span>
                      </div>
                      <p className="text-xs text-foreground-secondary mt-1">
                        {consolidatedMetrics?.is_mercado_lider 
                          ? consolidatedMetrics.mercado_lider_level 
                          : 'Não atingido'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
