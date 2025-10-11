import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Loader2, AlertCircle, Link as LinkIcon, Calendar, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
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
  const { user, userRole, loading: authLoading } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [links, setLinks] = useState<ImportantLink[]>([]);
  const [calls, setCalls] = useState<CallSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Dialog states
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string } | null>(null);

  // Form states
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editingLink, setEditingLink] = useState<ImportantLink | null>(null);
  const [editingCall, setEditingCall] = useState<CallSchedule | null>(null);

  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", is_important: false, is_active: true, expires_at: "" });
  const [linkForm, setLinkForm] = useState({ title: "", url: "", category: "" });
  const [callForm, setCallForm] = useState({ date: "", theme: "", description: "" });

  useEffect(() => {
    if (!authLoading && (!user || userRole !== 'manager')) {
      navigate('/auth');
      return;
    }

    if (user && userRole === 'manager') {
      loadData();
    }
  }, [user, userRole, authLoading, navigate]);

  const loadData = async () => {
    try {
      const [noticesData, linksData, callsData] = await Promise.all([
        supabase.from('notices').select('*').order('created_at', { ascending: false }),
        supabase.from('important_links').select('*').order('order_index', { ascending: true }),
        supabase.from('call_schedules').select('*').order('date', { ascending: true })
      ]);

      if (noticesData.error) throw noticesData.error;
      if (linksData.error) throw linksData.error;
      if (callsData.error) throw callsData.error;

      setNotices(noticesData.data || []);
      setLinks(linksData.data || []);
      setCalls(callsData.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Notice handlers
  const handleNoticeSubmit = async () => {
    try {
      if (editingNotice) {
        const { error } = await supabase
          .from('notices')
          .update({
            title: noticeForm.title,
            content: noticeForm.content,
            is_important: noticeForm.is_important,
            is_active: noticeForm.is_active,
            expires_at: noticeForm.expires_at || null
          })
          .eq('id', editingNotice.id);
        if (error) throw error;
        toast({ title: "Aviso atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from('notices')
          .insert({
            title: noticeForm.title,
            content: noticeForm.content,
            is_important: noticeForm.is_important,
            is_active: noticeForm.is_active,
            expires_at: noticeForm.expires_at || null
          });
        if (error) throw error;
        toast({ title: "Aviso criado com sucesso!" });
      }
      setNoticeDialogOpen(false);
      resetNoticeForm();
      loadData();
    } catch (error) {
      console.error('Error saving notice:', error);
      toast({ title: "Erro ao salvar aviso", variant: "destructive" });
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
    setNoticeForm({ title: "", content: "", is_important: false, is_active: true, expires_at: "" });
  };

  // Link handlers
  const handleLinkSubmit = async () => {
    try {
      if (editingLink) {
        const { error } = await supabase
          .from('important_links')
          .update({
            title: linkForm.title,
            url: linkForm.url,
            category: linkForm.category || null
          })
          .eq('id', editingLink.id);
        if (error) throw error;
        toast({ title: "Link atualizado com sucesso!" });
      } else {
        const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order_index)) : -1;
        const { error } = await supabase
          .from('important_links')
          .insert({
            title: linkForm.title,
            url: linkForm.url,
            category: linkForm.category || null,
            order_index: maxOrder + 1
          });
        if (error) throw error;
        toast({ title: "Link criado com sucesso!" });
      }
      setLinkDialogOpen(false);
      resetLinkForm();
      loadData();
    } catch (error) {
      console.error('Error saving link:', error);
      toast({ title: "Erro ao salvar link", variant: "destructive" });
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
    setLinkForm({ title: "", url: "", category: "" });
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
      const updates = newLinks.map((link, idx) => 
        supabase.from('important_links').update({ order_index: idx }).eq('id', link.id)
      );
      await Promise.all(updates);
      setLinks(newLinks);
      toast({ title: "Ordem atualizada!" });
    } catch (error) {
      console.error('Error updating order:', error);
      toast({ title: "Erro ao atualizar ordem", variant: "destructive" });
    }
  };

  // Call handlers
  const handleCallSubmit = async () => {
    try {
      if (editingCall) {
        const { error } = await supabase
          .from('call_schedules')
          .update({
            date: callForm.date,
            theme: callForm.theme,
            description: callForm.description || null
          })
          .eq('id', editingCall.id);
        if (error) throw error;
        toast({ title: "Call atualizada com sucesso!" });
      } else {
        const { error } = await supabase
          .from('call_schedules')
          .insert({
            date: callForm.date,
            theme: callForm.theme,
            description: callForm.description || null
          });
        if (error) throw error;
        toast({ title: "Call criada com sucesso!" });
      }
      setCallDialogOpen(false);
      resetCallForm();
      loadData();
    } catch (error) {
      console.error('Error saving call:', error);
      toast({ title: "Erro ao salvar call", variant: "destructive" });
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
    setCallForm({ date: "", theme: "", description: "" });
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      const { error } = await supabase
        .from(deleteItem.type === 'notice' ? 'notices' : deleteItem.type === 'link' ? 'important_links' : 'call_schedules')
        .delete()
        .eq('id', deleteItem.id);
      if (error) throw error;
      toast({ title: "Item excluído com sucesso!" });
      setDeleteDialogOpen(false);
      setDeleteItem(null);
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: "Erro ao excluir item", variant: "destructive" });
    }
  };


  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-display font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-foreground-secondary">Bem-vindo ao seu painel de controle</p>
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
                <Dialog open={noticeDialogOpen} onOpenChange={(open) => { setNoticeDialogOpen(open); if (!open) resetNoticeForm(); }}>
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
                        <Input id="notice-title" value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="notice-content">Conteúdo</Label>
                        <Textarea id="notice-content" rows={6} value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2">
                          <Checkbox 
                            id="notice-important" 
                            checked={noticeForm.is_important} 
                            onCheckedChange={(checked) => setNoticeForm({ ...noticeForm, is_important: checked as boolean })} 
                          />
                          <Label htmlFor="notice-important" className="cursor-pointer">Marcar como importante</Label>
                        </div>
                        <div>
                          <Label htmlFor="notice-expires">Expira em (opcional)</Label>
                          <Input id="notice-expires" type="date" value={noticeForm.expires_at} onChange={(e) => setNoticeForm({ ...noticeForm, expires_at: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setNoticeDialogOpen(false); resetNoticeForm(); }}>Cancelar</Button>
                      <Button onClick={handleNoticeSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                      className={`p-3 rounded-lg border ${
                        notice.is_important 
                          ? 'bg-primary/10 border-primary/30 shadow-sm' 
                          : 'bg-background-elevated border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          {notice.is_important && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                          <h4 className={`font-semibold text-sm ${notice.is_important ? 'text-primary' : ''}`}>
                            {notice.title}
                          </h4>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditNotice(notice)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { setDeleteItem({ type: 'notice', id: notice.id }); setDeleteDialogOpen(true); }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      <p className="text-xs text-foreground-secondary whitespace-pre-wrap">{notice.content}</p>
                    </div>
                  ))}
                </div>
              )}
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
                <Dialog open={linkDialogOpen} onOpenChange={(open) => { setLinkDialogOpen(open); if (!open) resetLinkForm(); }}>
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
                        <Input id="link-title" value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="link-url">URL</Label>
                        <Input id="link-url" type="url" value={linkForm.url} onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="link-category">Categoria (opcional)</Label>
                        <Input id="link-category" value={linkForm.category} onChange={(e) => setLinkForm({ ...linkForm, category: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setLinkDialogOpen(false); resetLinkForm(); }}>Cancelar</Button>
                      <Button onClick={handleLinkSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Acesso rápido</CardDescription>
            </CardHeader>
            <CardContent>
              {links.length === 0 ? (
                <p className="text-foreground-secondary text-sm">Nenhum link cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {links.map((link, index) => (
                    <div key={link.id} className="flex items-center gap-2 p-2 bg-background-elevated rounded-lg border border-border">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveLinkUp(index)} disabled={index === 0}>↑</Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => moveLinkDown(index)} disabled={index === links.length - 1}>↓</Button>
                      </div>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm font-medium text-primary hover:underline">{link.title}</a>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEditLink(link)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => { setDeleteItem({ type: 'link', id: link.id }); setDeleteDialogOpen(true); }}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximas Calls */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <CardTitle>Próximas Calls de Segunda-feira</CardTitle>
                </div>
                <Dialog open={callDialogOpen} onOpenChange={(open) => { setCallDialogOpen(open); if (!open) resetCallForm(); }}>
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
                        <Input id="call-date" type="date" value={callForm.date} onChange={(e) => setCallForm({ ...callForm, date: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="call-theme">Tema</Label>
                        <Input id="call-theme" value={callForm.theme} onChange={(e) => setCallForm({ ...callForm, theme: e.target.value })} />
                      </div>
                      <div>
                        <Label htmlFor="call-description">Descrição (opcional)</Label>
                        <Textarea id="call-description" rows={6} value={callForm.description} onChange={(e) => setCallForm({ ...callForm, description: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setCallDialogOpen(false); resetCallForm(); }}>Cancelar</Button>
                      <Button onClick={handleCallSubmit}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <CardDescription>Temas e datas das mentorias</CardDescription>
            </CardHeader>
            <CardContent>
              {calls.length === 0 ? (
                <p className="text-foreground-secondary text-sm">Nenhuma call agendada no momento</p>
              ) : (
                <div className="space-y-3">
                  {calls.map((call) => (
                    <div key={call.id} className="p-4 bg-background-elevated rounded-lg border border-border">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-sm font-semibold text-primary">{format(new Date(call.date), "dd/MM/yyyy", { locale: ptBR })}</div>
                          <h4 className="font-semibold text-sm">{call.theme}</h4>
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditCall(call)}><Pencil className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => { setDeleteItem({ type: 'call', id: call.id }); setDeleteDialogOpen(true); }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                      {call.description && <p className="text-xs text-foreground-secondary whitespace-pre-wrap">{call.description}</p>}
                    </div>
                  ))}
                </div>
              )}
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
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setDeleteItem(null); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GestorDashboard;
