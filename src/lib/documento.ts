/**
 * Validação de CPF, CNPJ e CEP — sem rede, para poder ser testada e para
 * recusar o dado errado no ato em vez de na hora de emitir a nota.
 *
 * O dígito verificador pega o erro que mais acontece: dígito trocado de
 * posição ao digitar. Não prova que o documento existe — para isso é preciso
 * consultar a Receita —, mas separa "digitou errado" de "é de outra empresa",
 * que são conversas diferentes.
 */

export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D/g, "");
}

/**
 * Sequências de dígito repetido (111.111.111-11) passam na conta do dígito
 * verificador e não existem na vida real. É o preenchimento de teste que mais
 * vaza para produção.
 */
function repetido(digitos: string): boolean {
  return /^(\d)\1+$/.test(digitos);
}

function somaPonderada(digitos: string, pesos: number[]): number {
  return pesos.reduce((total, peso, i) => total + Number(digitos[i]) * peso, 0);
}

function digitoDe(soma: number): number {
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 11 || repetido(d)) return false;

  const primeiro = digitoDe(somaPonderada(d, [10, 9, 8, 7, 6, 5, 4, 3, 2]));
  if (primeiro !== Number(d[9])) return false;

  const segundo = digitoDe(somaPonderada(d, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]));
  return segundo === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  if (d.length !== 14 || repetido(d)) return false;

  const primeiro = digitoDe(somaPonderada(d, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  if (primeiro !== Number(d[12])) return false;

  const segundo = digitoDe(somaPonderada(d, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]));
  return segundo === Number(d[13]);
}

/** CEP não tem dígito verificador: o que dá para exigir é o formato. */
export function cepValido(valor: string): boolean {
  return apenasDigitos(valor).length === 8;
}

export function formatarCpf(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  return d.replace(/^(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_, a, b, c, e) =>
    [a, b, c].filter(Boolean).join(".") + (e ? `-${e}` : "")
  );
}

export function formatarCnpj(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 14);
  if (d.length <= 2) return d;
  const partes = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 8)].filter(Boolean).join(".");
  const barra = d.length > 8 ? `/${d.slice(8, 12)}` : "";
  const traco = d.length > 12 ? `-${d.slice(12, 14)}` : "";
  return partes + barra + traco;
}

export function formatarCep(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
