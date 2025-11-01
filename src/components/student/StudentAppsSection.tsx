import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Plus, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { StudentApp } from "@/types/students";

interface StudentAppsSectionProps {
  studentId: string;
  studentApps: StudentApp[];
  availableApps: Array<{ id: string; name: string }>;
}

export function StudentAppsSection({
  studentId,
  studentApps,
  availableApps
}: StudentAppsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string>("");

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
    queryClient.invalidateQueries({ queryKey: ['student-apps', studentId] });
  };

  return (
    <>
      <Card className="h-full flex flex-col border border-border hover:shadow-lg transition-shadow duration-300">
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
        <CardContent className="pt-0 flex-1">
          {studentApps.length === 0 ? (
            <div className="text-center py-6">
              <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhum app associado</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {studentApps.map(app => (
                <div
                  key={app.id}
                  className="p-2 border rounded-lg flex items-center justify-between hover:bg-muted/50 transition-colors"
                  style={{ borderColor: (app as any).color }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: (app as any).color }}
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
    </>
  );
}

