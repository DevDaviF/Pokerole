import { Injectable } from '@nestjs/common';

@Injectable()
export class ClientesService {
  findAll() {
    return [
      {
        id: '1',
        nome: 'Cliente Exemplo',
        email: 'exemplo@email.com',
        status: 'Ativo',
      },
    ];
  }
}
