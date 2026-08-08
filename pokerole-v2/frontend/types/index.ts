export type Cliente = {
  id: string;
  nome: string;
  email: string;
  status: "Ativo" | "Inativo";
};

export type RelatorioResumo = {
  titulo: string;
  valor: number;
};
