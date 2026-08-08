import { RelatoriosPanel } from "@/features/relatorios/relatorios-panel";

export default function RelatoriosPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground text-sm">
          Consulte e exporte relatórios do sistema.
        </p>
      </div>
      <RelatoriosPanel />
    </div>
  );
}
