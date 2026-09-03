import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SupabaseService } from '../database/supabase.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async login(body: LoginDto) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });

    if (error) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return data;
  }

  async register(body: RegisterDto) {
    if (!body.email || !body.password) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const { data, error } = await this.supabaseService.getClient().auth.signUp({
      email: body.email,
      password: body.password,
    });

    if (error) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return data;
  }

  async logout() {
    const { error } = await this.supabaseService.getClient().auth.signOut();

    if (error) {
      throw new UnauthorizedException('Erro ao realizar logout');
    }

    return { message: 'Logout realizado com sucesso' };
  }

  async forgotPassword(body: ForgotPasswordDto) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.resetPasswordForEmail(body.email);

    if (error) {
      throw new UnauthorizedException('Erro ao resetar senha');
    }

    return data;
  }
}
