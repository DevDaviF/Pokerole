import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AutenticacaoService {
  login(body: LoginDto) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return {
      accessToken: 'dev-token',
      user: {
        id: '1',
        email: body.email,
        name: 'Usuário Demo',
      },
    };
  }
}
