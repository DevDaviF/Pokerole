import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutenticacaoModule } from './modules/autenticacao/autenticacao.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    AutenticacaoModule,
    ClientesModule,
    RelatoriosModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
