import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RelatoriosPanel() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Resumo mensal</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Em breve: métricas e exportação de relatórios.
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Clientes ativos</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Em breve: indicadores de clientes.
        </CardContent>
      </Card>
    </div>
  );
}
