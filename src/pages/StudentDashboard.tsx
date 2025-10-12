import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar } from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, Calendar, Link as LinkIcon, TrendingUp, DollarSign, Package, CheckCircle2 } from 'lucide-react';
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

const StudentDashboard = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [callSchedules, setCallSchedules] = useState<CallSchedule[]>([]);
  const [importantLinks, setImportantLinks] = useState<ImportantLink[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'student')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'student') {
      loadDashboardData();
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
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle>Desempenho - Últimos 30 Dias</CardTitle>
              </div>
              <CardDescription>
                <Badge variant="outline" className="mt-2">
                  Funcionalidade em desenvolvimento
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg border border-border bg-background-elevated">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-5 h-5 text-success" />
                    <span className="text-sm text-foreground-secondary">Faturamento</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">R$ 0,00</p>
                  <p className="text-xs text-foreground-secondary mt-1">Aguardando integração</p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-background-elevated">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-primary" />
                    <span className="text-sm text-foreground-secondary">Vendas</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">0</p>
                  <p className="text-xs text-foreground-secondary mt-1">Aguardando integração</p>
                </div>

                <div className="p-6 rounded-lg border border-border bg-background-elevated">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-warning" />
                    <span className="text-sm text-foreground-secondary">Ticket Médio</span>
                  </div>
                  <p className="text-3xl font-bold text-foreground">R$ 0,00</p>
                  <p className="text-xs text-foreground-secondary mt-1">Aguardando integração</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default StudentDashboard;
