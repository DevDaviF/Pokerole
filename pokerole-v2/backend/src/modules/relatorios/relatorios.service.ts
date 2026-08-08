import { Injectable } from '@nestjs/common';

@Injectable()
export class RelatoriosService {
  getResumo() {
    return [
      { titulo: 'Clientes ativos', valor: 1 },
      { titulo: 'Relatórios gerados', valor: 0 },
    ];
  }
}
