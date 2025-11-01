import { useState } from 'react';
import type { Notice, ImportantLink, CallSchedule } from '@/types/common';

/**
 * Hook para gerenciar estados de dialogs e formulários no dashboard do gestor
 * Consolida toda a lógica de abertura/fechamento de dialogs e gerenciamento de formulários
 */
export function useAdminDialogs() {
  // Dialog states
  const [noticeDialogOpen, setNoticeDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ type: string; id: string } | null>(null);

  // Form editing states
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [editingLink, setEditingLink] = useState<ImportantLink | null>(null);
  const [editingCall, setEditingCall] = useState<CallSchedule | null>(null);

  // Form data states
  const [noticeForm, setNoticeForm] = useState({
    title: '',
    content: '',
    is_important: false,
    is_active: true,
    expires_at: '',
  });

  const [linkForm, setLinkForm] = useState({
    title: '',
    url: '',
    category: '',
  });

  const [callForm, setCallForm] = useState({
    date: '',
    theme: '',
    description: '',
  });

  // Handlers para abrir dialogs de criação
  const openNoticeDialog = () => {
    setEditingNotice(null);
    setNoticeForm({
      title: '',
      content: '',
      is_important: false,
      is_active: true,
      expires_at: '',
    });
    setNoticeDialogOpen(true);
  };

  const openLinkDialog = () => {
    setEditingLink(null);
    setLinkForm({
      title: '',
      url: '',
      category: '',
    });
    setLinkDialogOpen(true);
  };

  const openCallDialog = () => {
    setEditingCall(null);
    setCallForm({
      date: '',
      theme: '',
      description: '',
    });
    setCallDialogOpen(true);
  };

  // Handlers para abrir dialogs de edição
  const openNoticeEditDialog = (notice: Notice) => {
    setEditingNotice(notice);
    setNoticeForm({
      title: notice.title,
      content: notice.content,
      is_important: notice.is_important || false,
      is_active: notice.is_active,
      expires_at: notice.expires_at || '',
    });
    setNoticeDialogOpen(true);
  };

  const openLinkEditDialog = (link: ImportantLink) => {
    setEditingLink(link);
    setLinkForm({
      title: link.title,
      url: link.url,
      category: link.category || '',
    });
    setLinkDialogOpen(true);
  };

  const openCallEditDialog = (call: CallSchedule) => {
    setEditingCall(call);
    setCallForm({
      date: call.date || call.scheduled_at || '',
      theme: call.theme || '',
      description: call.description || call.notes || '',
    });
    setCallDialogOpen(true);
  };

  // Handler para abrir dialog de confirmação de delete
  const openDeleteDialog = (type: string, id: string) => {
    setDeleteItem({ type, id });
    setDeleteDialogOpen(true);
  };

  // Handlers para fechar dialogs
  const closeNoticeDialog = () => {
    setNoticeDialogOpen(false);
    setEditingNotice(null);
  };

  const closeLinkDialog = () => {
    setLinkDialogOpen(false);
    setEditingLink(null);
  };

  const closeCallDialog = () => {
    setCallDialogOpen(false);
    setEditingCall(null);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setDeleteItem(null);
  };

  return {
    // Dialog open states
    noticeDialogOpen,
    linkDialogOpen,
    callDialogOpen,
    deleteDialogOpen,
    deleteItem,

    // Editing states
    editingNotice,
    editingLink,
    editingCall,

    // Form data
    noticeForm,
    linkForm,
    callForm,

    // Form setters
    setNoticeForm,
    setLinkForm,
    setCallForm,

    // Open handlers
    openNoticeDialog,
    openLinkDialog,
    openCallDialog,
    openNoticeEditDialog,
    openLinkEditDialog,
    openCallEditDialog,
    openDeleteDialog,

    // Close handlers
    closeNoticeDialog,
    closeLinkDialog,
    closeCallDialog,
    closeDeleteDialog,

    // Direct setters (para casos especiais)
    setNoticeDialogOpen,
    setLinkDialogOpen,
    setCallDialogOpen,
    setDeleteDialogOpen,
    setDeleteItem,
  };
}

