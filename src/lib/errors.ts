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
  return message
}
