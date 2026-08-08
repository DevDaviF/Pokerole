import { ClientesTable } from "@/features/clientes/clientes-table";

export default function ClientesPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os clientes cadastrados.
        </p>
      </div>
      <ClientesTable />
    </div>
  );
}
