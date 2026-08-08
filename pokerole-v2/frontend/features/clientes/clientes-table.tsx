import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockClientes = [
  { id: "1", nome: "Cliente Exemplo", email: "exemplo@email.com", status: "Ativo" },
];

export function ClientesTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {mockClientes.map((cliente) => (
          <TableRow key={cliente.id}>
            <TableCell>{cliente.nome}</TableCell>
            <TableCell>{cliente.email}</TableCell>
            <TableCell>
              <Badge variant="secondary">{cliente.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
