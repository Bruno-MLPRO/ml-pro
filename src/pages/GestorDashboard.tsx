import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, AlertCircle, Link as LinkIcon, Calendar, Plus, Pencil, Trash2, CheckCircle2, TrendingUp, Target, Package, DollarSign, RefreshCw, MapPin, Truck, Warehouse, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
interface Notice {
  id: string;
  title: string;
  content: string;
  is_important: boolean;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}
interface ImportantLink {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string | null;
  order_index: number;
}
interface CallSchedule {
  id: string;
  date: string;
  theme: string;
  description: string | null;
}
const GestorDashboard = () => {
  const {
    user,
    userRole,
    loading: authLoading
  } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [calls, setCalls] = useState<CallSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();

  // Dialog states
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    type: string;
    id: string;
  } | null>(null);

  // Form states
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editingLink, setEditingLink] = useState<ImportantLink | null>(null);
  const [editingCall, setEditingCall] = useState<CallSchedule | null>(null);
  const [noticeForm, setNoticeForm] = useState({
    title: "",
    content: "",
    is_important: false,
    is_active: true,
    expires_at: ""
  });
  const [linkForm, setLinkForm] = useState({
    title: "",
    url: "",
    category: ""
  });
  const [callForm, setCallForm] = useState({
    date: "",
    theme: "",
    description: ""
  });

  // Consolidated metrics state
  const [consolidatedMetrics, setConsolidatedMetrics] = useState({
    totalRevenue: 0,
    totalSales: 0,
    averageTicket: 0,
    shippingStats: {
      correios: 0,
      flex: 0,
      agencias: 0,
      coleta: 0,
      full: 0,
      total: 0
    },
    adsMetrics: {
      totalSpend: 0,
      totalRevenue: 0,
      advertisedSales: 0,
      avgRoas: 0,
      avgAcos: 0
    }
  });

  // Admin actions state
  const [syncingAccounts, setSyncingAccounts] = useState(false);
  const [updatingMetrics, setUpdatingMetrics] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    current: number;
    status: string;
  } | null>(null);
  const [metricsReloadPending, setMetricsReloadPending] = useState(false);
  const metricsDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced reload function
  const debouncedLoadMetrics = useCallback(() => {
    if (syncingAccounts) {
      console.log('⏸️ Skipping metrics reload: sync in progress');
      return;
    }
    if (metricsDebounceRef.current) {
      clearTimeout(metricsDebounceRef.current);
    }
    setMetricsReloadPending(true);
    metricsDebounceRef.current = setTimeout(() => {
      console.log('🔄 Debounced reload: executing now');
      loadConsolidatedMetrics();
      setMetricsReloadPending(false);
    }, 3000);
  }, [syncingAccounts]);
  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager' && userRole !== 'administrator')) {
      navigate('/auth');
      return;
    }
    if (user && (userRole === 'manager' || userRole === 'administrator')) {
      loadData();

      // Set up realtime subscriptions with debounce
      const ordersChannel = supabase.channel('orders-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mercado_livre_orders'
      }, () => {
        console.log('🔄 Realtime: orders changed, scheduling reload...');
        debouncedLoadMetrics();
      }).subscribe();
      const productsChannel = supabase.channel('products-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mercado_livre_products'
      }, () => {
        console.log('🔄 Realtime: products changed, scheduling reload...');
        debouncedLoadMetrics();
      }).subscribe();
      const campaignsChannel = supabase.channel('campaigns-changes').on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mercado_livre_campaigns'
      }, () => {
        console.log('🔄 Realtime: campaigns changed, scheduling reload...');
        debouncedLoadMetrics();
      }).subscribe();

      // Cleanup on unmount
      return () => {
        console.log('🧹 Cleaning up realtime subscriptions...');
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(productsChannel);
        supabase.removeChannel(campaignsChannel);
        if (metricsDebounceRef.current) {
          clearTimeout(metricsDebounceRef.current);
        }
      };
    }
  }, [user, userRole, authLoading, navigate, debouncedLoadMetrics]);
  const loadData = async () => {
    try {
      const [noticesData, linksData, callsData] = await Promise.all([supabase.from('notices').select('*').order('created_at', {
        ascending: false
      }), supabase.from('important_links').select('*').order('order_index', {
        ascending: true
      }), supabase.from('call_schedules').select('*').order('date', {
        ascending: true
      })]);
      if (noticesData.error) throw noticesData.error;
      if (linksData.error) throw linksData.error;
      if (callsData.error) throw callsData.error;
      setNotices(noticesData.data || []);
      setLinks(linksData.data || []);
      setCalls(callsData.data || []);

      // Load consolidated metrics
      await loadConsolidatedMetrics();
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const loadConsolidatedMetrics = async () => {
    try {
      console.log('🔄 Carregando métricas consolidadas em tempo real...');
      
      // Definir período: últimos 30 dias
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 30);

      console.log('📅 Período:', {
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString()
      });

      // 1. Buscar TODOS os pedidos pagos com paginação
      let allOrders: any[] = [];
      let currentPage = 0;
      const PAGE_SIZE = 1000;
      let hasMore = true;

      console.log('🔄 Iniciando paginação de pedidos...');

      while (hasMore && allOrders.length < 10000) { // limite de segurança
        const rangeStart = currentPage * PAGE_SIZE;
        const rangeEnd = rangeStart + PAGE_SIZE - 1;
        
        const { data: pageOrders, error: ordersError } = await supabase
          .from('mercado_livre_orders')
          .select('paid_amount, total_amount, ml_order_id')
          .eq('status', 'paid')
          .gte('date_created', periodStart.toISOString())
          .lt('date_created', periodEnd.toISOString())
          .order('date_created', { ascending: false })
          .range(rangeStart, rangeEnd);
        
        if (ordersError) {
          console.error('❌ Error loading orders:', ordersError);
          throw ordersError;
        }

        if (!pageOrders || pageOrders.length === 0) {
          hasMore = false;
          break;
        }

        allOrders = [...allOrders, ...pageOrders];
        console.log(`📦 Página ${currentPage + 1}: ${pageOrders.length} pedidos (Total: ${allOrders.length})`);

        if (pageOrders.length < PAGE_SIZE) {
          hasMore = false;
        }

        currentPage++;
      }

      const totalRevenue = allOrders.reduce((sum, order) => sum + (Number(order.paid_amount) || 0), 0);
      const totalSales = allOrders.length;
      const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

      console.log('💰 Vendas consolidadas:', { 
        totalRevenue, 
        totalSales,
        averageTicket,
        totalOrders: allOrders.length 
      });

      // 2. Produtos Ativos por Tipo de Envio (CORRIGIDO)
      const { data: productsData, error: productsError } = await supabase
        .from('mercado_livre_products')
        .select('shipping_mode, logistic_type')
        .eq('status', 'active');

      if (productsError) {
        console.error('❌ Error loading products:', productsError);
        throw productsError;
      }

      const total = productsData?.length || 0;
      
      // Seguir o mesmo padrão do StudentDashboard
      const flex = productsData?.filter(p => 
        p.shipping_mode === 'me2' && p.logistic_type === 'drop_off'
      ).length || 0;
      
      const agencias = productsData?.filter(p => 
        p.shipping_mode === 'me2' && p.logistic_type === 'xd_drop_off'
      ).length || 0;
      
      const coleta = productsData?.filter(p => 
        p.shipping_mode === 'me2' && p.logistic_type === 'cross_docking'
      ).length || 0;
      
      const full = productsData?.filter(p => 
        p.shipping_mode === 'me2' && p.logistic_type === 'fulfillment'
      ).length || 0;
      
      const correios = total - (flex + agencias + coleta + full);

      console.log('📦 Produtos por tipo de envio:', {
        total,
        correios,
        flex,
        agencias,
        coleta,
        full
      });

      // 3. Métricas de Product Ads
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('mercado_livre_campaigns')
        .select('total_spend, ad_revenue, advertised_sales')
        .gte('synced_at', periodStart.toISOString())
        .lt('synced_at', periodEnd.toISOString());

      if (campaignsError) {
        console.error('❌ Error loading campaigns:', campaignsError);
        throw campaignsError;
      }

      const totalSpend = campaignsData?.reduce((sum, c) => sum + (Number(c.total_spend) || 0), 0) || 0;
      const totalAdRevenue = campaignsData?.reduce((sum, c) => sum + (Number(c.ad_revenue) || 0), 0) || 0;
      const totalAdSales = campaignsData?.reduce((sum, c) => sum + (Number(c.advertised_sales) || 0), 0) || 0;

      const avgRoas = totalSpend > 0 ? totalAdRevenue / totalSpend : 0;
      const avgAcos = totalAdRevenue > 0 ? (totalSpend / totalAdRevenue) * 100 : 0;

      console.log('📊 Product Ads consolidadas:', {
        totalSpend,
        totalAdRevenue,
        totalAdSales,
        avgRoas: avgRoas.toFixed(2),
        avgAcos: avgAcos.toFixed(2) + '%'
      });

      setConsolidatedMetrics({
        totalRevenue,
        totalSales,
        averageTicket,
        shippingStats: {
          correios,
          flex,
          agencias,
          coleta,
          full,
          total
        },
        adsMetrics: {
          totalSpend,
          totalRevenue: totalAdRevenue,
          advertisedSales: totalAdSales,
          avgRoas,
          avgAcos
        }
      });

    } catch (error) {
      console.error('❌ Erro ao carregar métricas consolidadas:', error);
      toast({
        title: "Erro ao carregar métricas",
        description: error instanceof Error ? error.message : "Ocorreu um erro",
        variant: "destructive"
      });
    }
  };

  // Helper functions
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };
  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  // Admin action handlers
  const handleSyncAllAccounts = async () => {
    setSyncingAccounts(true);
    setSyncProgress({
      total: 0,
      current: 0,
      status: 'Iniciando sincronização...'
    });
    try {
      console.log('🚀 Iniciando sincronização de todas as contas ML...');
      const {
        data,
        error
      } = await supabase.functions.invoke('ml-auto-sync-all', {
        body: {}
      });
      if (error) throw error;
      console.log('✅ Sincronização iniciada:', data);

      // Show immediate toast
      toast({
        title: "🚀 Sincronização Iniciada",
        description: `Processando ${data.total_accounts} contas em background. Aguarde 1-2 minutos.`
      });

      // Poll for status
      const logId = data.log_id;
      let pollAttempts = 0;
      const maxPolls = 12; // 2 minutes

      const pollInterval = setInterval(async () => {
        pollAttempts++;
        try {
          const {
            data: statusData,
            error: statusError
          } = await supabase.functions.invoke('ml-sync-status', {
            body: {
              log_id: logId
            }
          });
          if (statusError) {
            console.warn('Status poll error:', statusError);
            return;
          }

          // Update progress
          setSyncProgress({
            total: statusData.total_accounts,
            current: statusData.successful_syncs,
            status: statusData.status === 'completed' ? 'Finalizado' : `${statusData.successful_syncs}/${statusData.total_accounts} concluídas`
          });
          if (statusData.status === 'completed') {
            clearInterval(pollInterval);

            // Auto-calculate metrics
            setSyncProgress({
              total: statusData.total_accounts,
              current: statusData.successful_syncs,
              status: 'Recalculando métricas...'
            });
            const {
              error: metricsError
            } = await supabase.functions.invoke('calculate-monthly-metrics', {
              body: {}
            });
            if (metricsError) {
              console.warn('⚠️ Erro ao recalcular métricas:', metricsError);
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            await loadConsolidatedMetrics();
            toast({
              title: "✅ Sincronização Concluída!",
              description: `${statusData.successful_syncs} contas sincronizadas, ${statusData.tokens_renewed} tokens renovados`
            });
            setSyncingAccounts(false);
            setSyncProgress(null);
          }
        } catch (pollError) {
          console.error('Poll error:', pollError);
        }
        if (pollAttempts >= maxPolls) {
          clearInterval(pollInterval);
          toast({
            title: "⏱️ Sincronização em andamento",
            description: "Recarregue a página em alguns minutos."
          });
          setSyncingAccounts(false);
          setSyncProgress(null);
        }
      }, 10000);
    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast({
        title: "❌ Erro na Sincronização",
        description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido",
        variant: "destructive"
      });
      setSyncingAccounts(false);
      setSyncProgress(null);
    }
  };
  // Função removida - métricas são calculadas em tempo real

  // Notice handlers
  const handleNoticeSubmit = async () => {
    try {
      if (editingNotice) {
        const {
          error
        } = await supabase.from('notices').update({
          title: noticeForm.title,
          content: noticeForm.content,
          is_important: noticeForm.is_important,
          is_active: noticeForm.is_active,
          expires_at: noticeForm.expires_at || null
        }).eq('id', editingNotice.id);
        if (error) throw error;
        toast({
          title: "Aviso atualizado com sucesso!"
        });
      } else {
        const {
          error
        } = await supabase.from('notices').insert({
          title: noticeForm.title,
          content: noticeForm.content,
          is_important: noticeForm.is_important,
          is_active: noticeForm.is_active,
          expires_at: noticeForm.expires_at || null
        });
        if (error) throw error;
        toast({
          title: "Aviso criado com sucesso!"
        });
      }
      setNoticeDialogOpen(false);
      resetNoticeForm();
      loadData();
    } catch (error) {
      console.error('Error saving notice:', error);
      toast({
        title: "Erro ao salvar aviso",
        variant: "destructive"
      });
    }
  };
  const openEditNotice = (notice: Notice) => {
    setEditingNotice(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      is_important: notice.is_important,
      is_active: notice.is_active,
      expires_at: notice.expires_at || ""
    });
    setNoticeDialogOpen(true);
  };
  const resetNoticeForm = () => {
    setEditingNotice(null);
    setNoticeForm({
      title: "",
      content: "",
      is_important: false,
      is_active: true,
      expires_at: ""
    });
  };

  // Link handlers
  const handleLinkSubmit = async () => {
    try {
      if (editingLink) {
        const {
          error
        } = await supabase.from('important_links').update({
          title: linkForm.title,
          url: linkForm.url,
          category: linkForm.category || null
        }).eq('id', editingLink.id);
        if (error) throw error;
        toast({
          title: "Link atualizado com sucesso!"
        });
      } else {
        const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order_index)) : -1;
        const {
          error
        } = await supabase.from('important_links').insert({
          title: linkForm.title,
          url: linkForm.url,
          category: linkForm.category || null,
          order_index: maxOrder + 1
        });
        if (error) throw error;
        toast({
          title: "Link criado com sucesso!"
        });
      }
      setLinkDialogOpen(false);
      resetLinkForm();
      loadData();
    } catch (error) {
      console.error('Error saving link:', error);
      toast({
        title: "Erro ao salvar link",
        variant: "destructive"
      });
    }
  };
  const openEditLink = (link: ImportantLink) => {
    setEditingLink(link);
    setLinkForm({
      title: link.title,
      url: link.url,
      category: link.category || ""
    });
    setLinkDialogOpen(true);
  };
  const resetLinkForm = () => {
    setEditingLink(null);
    setLinkForm({
      title: "",
      url: "",
      category: ""
    });
  };
  const moveLinkUp = async (index: number) => {
    if (index === 0) return;
    const newLinks = [...links];
    [newLinks[index - 1], newLinks[index]] = [newLinks[index], newLinks[index - 1]];
    await updateLinkOrders(newLinks);
  };
  const moveLinkDown = async (index: number) => {
    if (index === links.length - 1) return;
    const newLinks = [...links];
    [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
    await updateLinkOrders(newLinks);
  };
  const updateLinkOrders = async (newLinks: ImportantLink[]) => {
    try {
      const updates = newLinks.map((link, idx) => supabase.from('important_links').update({
        order_index: idx
      }).eq('id', link.id));
      await Promise.all(updates);
      setLinks(newLinks);
      toast({
        title: "Ordem atualizada!"
      });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "Erro ao atualizar ordem",
        variant: "destructive"
      });
    }
  };

  // Call handlers
  const handleCallSubmit = async () => {
    try {
      if (editingCall) {
        const {
          error
        } = await supabase.from('call_schedules').update({
          date: callForm.date,
          theme: callForm.theme,
          description: callForm.description || null
        }).eq('id', editingCall.id);
        if (error) throw error;
        toast({
          title: "Call atualizada com sucesso!"
        });
      } else {
        const {
          error
        } = await supabase.from('call_schedules').insert({
          date: callForm.date,
          theme: callForm.theme,
          description: callForm.description || null
        });
        if (error) throw error;
        toast({
          title: "Call criada com sucesso!"
        });
      }
      setCallDialogOpen(false);
      resetCallForm();
      loadData();
    } catch (error) {
      console.error('Error saving call:', error);
      toast({
        title: "Erro ao salvar call",
        variant: "destructive"
      });
    }
  };
  const openEditCall = (call: CallSchedule) => {
    setEditingCall(call);
    setCallForm({
      date: call.date,
      theme: call.theme,
      description: call.description || ""
    });
    setCallDialogOpen(true);
  };
  const resetCallForm = () => {
    setEditingCall(null);
    setCallForm({
      date: "",
      theme: "",
      description: ""
    });
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const {
        error
      } = await supabase.from(deleteItem.type === 'notice' ? 'notices' : deleteItem.type === 'link' ? 'important_links' : 'call_schedules').delete().eq('id', deleteItem.id);
      if (error) throw error;
      toast({
        title: "Item excluído com sucesso!"
      });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({
        title: "Erro ao excluir item",
        variant: "destructive"
      });
    }
  };
  if (authLoading || loading) {
    return <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>;
  }
  return <div className="flex min-h-screen w-full bg-background">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-foreground-secondary">Bem-vindo ao seu painel de controle</p>
        </div>

        {/* Dashboard de Desempenho */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <CardTitle>Desempenho</CardTitle>
              </div>
              <Button onClick={handleSyncAllAccounts} disabled={syncingAccounts} variant="outline" size="sm" className="gap-2">
                {syncingAccounts ? <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sincronizando...
                  </> : <>
                    <RefreshCw className="w-4 h-4" />
                    Sincronizar Contas
                  </>}
              </Button>
            </div>
            <CardDescription>
              Últimos 30 dias a partir de hoje - {format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'dd/MM/yyyy', { locale: ptBR })} a {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress indicator para sincronização */}
            {syncProgress && <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      {syncProgress.status}
                    </p>
                    {syncProgress.total > 0 && <p className="text-xs text-blue-600 dark:text-blue-400">
                        {syncProgress.current} de {syncProgress.total} contas processadas
                      </p>}
                  </div>
                </div>
              </div>}

            {/* Indicador de debounce */}
            {metricsReloadPending && !syncProgress && <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2 mb-4">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-900 dark:text-blue-100">
                  Atualizações pendentes... recarregando em breve
                </span>
              </div>}
            
            {/* Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-lg border border-border bg-background-elevated">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-success" />
                  <span className="text-sm text-foreground-secondary">Faturamento</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(consolidatedMetrics.totalRevenue)}
                </p>
                <p className="text-xs text-foreground-secondary mt-1">
                  Últimos 30 dias
                </p>
              </div>
              
              <div className="p-6 rounded-lg border border-border bg-background-elevated">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span className="text-sm text-foreground-secondary">Número de vendas</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {consolidatedMetrics.totalSales}
                </p>
                <p className="text-xs text-foreground-secondary mt-1">
                  Últimos 30 dias
                </p>
              </div>
              
              <div className="p-6 rounded-lg border border-border bg-background-elevated">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-warning" />
                  <span className="text-sm text-foreground-secondary">Ticket Médio</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(consolidatedMetrics.averageTicket)}
                </p>
                <p className="text-xs text-foreground-secondary mt-1">
                  Últimos 30 dias
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Product Ads */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-accent" />
              <CardTitle>Product Ads</CardTitle>
            </div>
            <CardDescription>
              Métricas de anúncios - Últimos 30 dias
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
                <p className="text-2xl font-bold">{formatCurrency(consolidatedMetrics.adsMetrics.totalSpend)}</p>
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
                <p className="text-2xl font-bold">{formatCurrency(consolidatedMetrics.adsMetrics.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {consolidatedMetrics.adsMetrics.advertisedSales} vendas
                </p>
              </div>
              
              {/* ROAS */}
              <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-blue-400" />
                  <span className="text-sm font-medium">ROAS</span>
                </div>
                <p className="text-2xl font-bold">{consolidatedMetrics.adsMetrics.avgRoas.toFixed(2)}x</p>
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
                <p className="text-2xl font-bold">{consolidatedMetrics.adsMetrics.avgAcos.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Custo de aquisição
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card Tipos de Envio */}
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
              {consolidatedMetrics.shippingStats.flex > 0 ? (
                <div className="p-4 rounded-lg border border-blue-500/50 bg-blue-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-blue-400" />
                      <span className="font-semibold">FLEX</span>
                    </div>
                    <Badge className="bg-blue-500">
                      {consolidatedMetrics.shippingStats.flex} produto{consolidatedMetrics.shippingStats.flex !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(consolidatedMetrics.shippingStats.flex / consolidatedMetrics.shippingStats.total) * 100} className="h-1 flex-1" />
                    <span className="text-xs font-medium">{((consolidatedMetrics.shippingStats.flex / consolidatedMetrics.shippingStats.total) * 100).toFixed(0)}%</span>
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
              {consolidatedMetrics.shippingStats.agencias > 0 ? (
                <div className="p-4 rounded-lg border border-purple-500/50 bg-purple-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      <span className="font-semibold">Agências</span>
                    </div>
                    <Badge className="bg-purple-500">
                      {consolidatedMetrics.shippingStats.agencias} produto{consolidatedMetrics.shippingStats.agencias !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(consolidatedMetrics.shippingStats.agencias / consolidatedMetrics.shippingStats.total) * 100} className="h-1 flex-1" />
                    <span className="text-xs font-medium">{((consolidatedMetrics.shippingStats.agencias / consolidatedMetrics.shippingStats.total) * 100).toFixed(0)}%</span>
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
              {consolidatedMetrics.shippingStats.coleta > 0 ? (
                <div className="p-4 rounded-lg border border-green-500/50 bg-green-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-green-400" />
                      <span className="font-semibold">Coleta</span>
                    </div>
                    <Badge className="bg-green-500">
                      {consolidatedMetrics.shippingStats.coleta} produto{consolidatedMetrics.shippingStats.coleta !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(consolidatedMetrics.shippingStats.coleta / consolidatedMetrics.shippingStats.total) * 100} className="h-1 flex-1" />
                    <span className="text-xs font-medium">{((consolidatedMetrics.shippingStats.coleta / consolidatedMetrics.shippingStats.total) * 100).toFixed(0)}%</span>
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
              {consolidatedMetrics.shippingStats.full > 0 ? (
                <div className="p-4 rounded-lg border border-orange-500/50 bg-orange-500/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-5 h-5 text-orange-400" />
                      <span className="font-semibold">FULL</span>
                    </div>
                    <Badge className="bg-orange-500">
                      {consolidatedMetrics.shippingStats.full} produto{consolidatedMetrics.shippingStats.full !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={(consolidatedMetrics.shippingStats.full / consolidatedMetrics.shippingStats.total) * 100} className="h-1 flex-1" />
                    <span className="text-xs font-medium">{((consolidatedMetrics.shippingStats.full / consolidatedMetrics.shippingStats.total) * 100).toFixed(0)}%</span>
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
                <span className="font-semibold">{consolidatedMetrics.shippingStats.total}</span>
              </div>
              {consolidatedMetrics.shippingStats.correios > 0 && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-muted-foreground">Envio próprio (Correios)</span>
                  <span>{consolidatedMetrics.shippingStats.correios} ({((consolidatedMetrics.shippingStats.correios / consolidatedMetrics.shippingStats.total) * 100).toFixed(0)}%)</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Gestão de Conteúdo */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-foreground">Gestão de Conteúdo</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Avisos Importantes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <CardTitle>Avisos Importantes</CardTitle>
                </div>
                <Dialog open={noticeDialogOpen} onOpenChange={open => {
                setNoticeDialogOpen(open);
                if (!open) resetNoticeForm();
              }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost"><Plus className="w-4 h-4" /></Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingNotice ? 'Editar' : 'Novo'} Aviso</DialogTitle>
                      <DialogDescription>Últimas notificações e comunicados</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="notice-title">Título</Label>
                        <Input id="notice-title" value={noticeForm.title} onChange={e => setNoticeForm({
                        ...noticeForm,
                        title: e.target.value
                      })} />
                      </div>
                      <div>
                        <Label htmlFor="notice-content">Conteúdo</Label>
                        <Textarea id="notice-content" rows={6} value={noticeForm.content} onChange={e => setNoticeForm({
                        ...noticeForm,
                        content: e.target.value
                      })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="notice-important" checked={noticeForm.is_important} onCheckedChange={checked => setNoticeForm({
                          ...noticeForm,
                          is_important: checked as boolean
                        })} />
                          <Label htmlFor="notice-important" className="cursor-pointer">Marcar como importante</Label>
                        </div>
                        <div>
                          <Label htmlFor="notice-expires">Expira em (opcional)</Label>
                          <Input id="notice-expires" type="date" value={noticeForm.expires_at} onChange={e => setNoticeForm({
                          ...noticeForm,
                          expires_at: e.target.value
                        })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                      setNoticeDialogOpen(false);
                      resetNoticeForm();
                    }}>Cancelar</Button>
                      <Button onClick={handleNoticeSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Últimas notificações e comunicados</CardDescription>
            </CardHeader>
            <CardContent>
              {notices.length === 0 ? <p className="text-foreground-secondary text-sm">Nenhum aviso no momento</p> : <div className="space-y-3">
                  {notices.map(notice => <div key={notice.id} className={`p-3 rounded-lg border ${notice.is_important ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-background-elevated border-border'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {notice.is_important && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                          <h4 className={`font-semibold text-sm ${notice.is_important ? 'text-primary' : ''}`}>
                            {notice.title}
                          </h4>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditNotice(notice)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                      setDeleteItem({
                        type: 'notice',
                        id: notice.id
                      });
                      setDeleteDialogOpen(true);
                    }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-foreground-secondary whitespace-pre-wrap">{notice.content}</p>
                    </div>)}
                </div>}
            </CardContent>
          </Card>

          {/* Links Importantes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-primary" />
                  <CardTitle>Links Importantes</CardTitle>
                </div>
                <Dialog open={linkDialogOpen} onOpenChange={open => {
                setLinkDialogOpen(open);
                if (!open) resetLinkForm();
              }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost"><Plus className="w-4 h-4" /></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingLink ? 'Editar' : 'Novo'} Link</DialogTitle>
                      <DialogDescription>Acesso rápido</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="link-title">Título</Label>
                        <Input id="link-title" value={linkForm.title} onChange={e => setLinkForm({
                        ...linkForm,
                        title: e.target.value
                      })} />
                      </div>
                      <div>
                        <Label htmlFor="link-url">URL</Label>
                        <Input id="link-url" type="url" value={linkForm.url} onChange={e => setLinkForm({
                        ...linkForm,
                        url: e.target.value
                      })} />
                      </div>
                      <div>
                        <Label htmlFor="link-category">Categoria (opcional)</Label>
                        <Input id="link-category" value={linkForm.category} onChange={e => setLinkForm({
                        ...linkForm,
                        category: e.target.value
                      })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                      setLinkDialogOpen(false);
                      resetLinkForm();
                    }}>Cancelar</Button>
                      <Button onClick={handleLinkSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Acesso rápido</CardDescription>
            </CardHeader>
            <CardContent>
              {links.length === 0 ? <p className="text-foreground-secondary text-sm">Nenhum link cadastrado</p> : <div className="space-y-2">
                  {links.map((link, index) => <div key={link.id} className="flex items-center gap-2 p-2 bg-background-elevated rounded-lg border border-border">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveLinkUp(index)} disabled={index === 0}>↑</Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveLinkDown(index)} disabled={index === links.length - 1}>↓</Button>
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium text-primary hover:underline">{link.title}</a>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditLink(link)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                    setDeleteItem({
                      type: 'link',
                      id: link.id
                    });
                    setDeleteDialogOpen(true);
                  }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>)}
                </div>}
            </CardContent>
          </Card>

          {/* Próximas Calls */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle>Próximas Calls</CardTitle>
                </div>
                <Dialog open={callDialogOpen} onOpenChange={open => {
                setCallDialogOpen(open);
                if (!open) resetCallForm();
              }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="ghost"><Plus className="w-4 h-4" /></Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingCall ? 'Editar' : 'Nova'} Call</DialogTitle>
                      <DialogDescription>Temas e datas das mentorias</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="call-date">Data</Label>
                        <Input id="call-date" type="date" value={callForm.date} onChange={e => setCallForm({
                        ...callForm,
                        date: e.target.value
                      })} />
                      </div>
                      <div>
                        <Label htmlFor="call-theme">Tema</Label>
                        <Input id="call-theme" value={callForm.theme} onChange={e => setCallForm({
                        ...callForm,
                        theme: e.target.value
                      })} />
                      </div>
                      <div>
                        <Label htmlFor="call-description">Descrição (opcional)</Label>
                        <Textarea id="call-description" rows={6} value={callForm.description} onChange={e => setCallForm({
                        ...callForm,
                        description: e.target.value
                      })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                      setCallDialogOpen(false);
                      resetCallForm();
                    }}>Cancelar</Button>
                      <Button onClick={handleCallSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Temas e datas das mentorias</CardDescription>
            </CardHeader>
            <CardContent>
              {calls.length === 0 ? <p className="text-foreground-secondary text-sm">Nenhuma call agendada no momento</p> : <div className="space-y-3">
                  {calls.map(call => <div key={call.id} className="p-4 bg-background-elevated rounded-lg border border-border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-sm font-semibold text-primary">{format(new Date(call.date), "dd/MM/yyyy", {
                        locale: ptBR
                      })}</div>
                          <h4 className="font-semibold text-sm">{call.theme}</h4>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditCall(call)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => {
                      setDeleteItem({
                        type: 'call',
                        id: call.id
                      });
                      setDeleteDialogOpen(true);
                    }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      {call.description && <p className="text-xs text-foreground-secondary whitespace-pre-wrap">{call.description}</p>}
                    </div>)}
                </div>}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
            setDeleteDialogOpen(false);
            setDeleteItem(null);
          }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default GestorDashboard;