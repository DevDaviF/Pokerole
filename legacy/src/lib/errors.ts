// Traduz erros de rede genéricos do navegador/Supabase pra uma mensagem
// que dá pra agir (em vez de "TypeError: NetworkError when attempting to
// fetch resource.", que só confunde). Erros de regra de negócio (RLS,
// validação) já vêm com mensagem legível do Postgres e passam direto.
export function friendlyError(message: string): string {
  const networky =
    /networkerror|failed to fetch|load failed|network request failed|fetch/i.test(
      message,
    )
  if (networky) {
    return 'Falha de conexão com o servidor. Confira sua internet e tente de novo em alguns segundos.'
  }
  // A checagem de disponibilidade (username_available) já pega a maioria
  // dos casos antes de tentar cadastrar, mas cobre a corrida rara de dois
  // cadastros com o mesmo nome ao mesmo tempo — sem isso, o erro batido
  // direto do Postgres ("duplicate key value violates unique constraint
  // profiles_username_lower_key") não diz nada pra quem está cadastrando.
  if (/profiles_username_lower_key|duplicate key.*username/i.test(message)) {
    return 'Esse nome de usuário já está em uso. Escolha outro.'
  }
  return message
}
