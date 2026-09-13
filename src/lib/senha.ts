/**
 * Geração e conferência de senha.
 *
 * A equipe não inventa senha. Quem cria um acesso ou redefine o de alguém
 * recebe uma senha sorteada aqui, entrega uma vez, e ela morre na primeira
 * entrada — o usuário é obrigado a trocar antes de ver qualquer tela. Num
 * sistema que decide repasse, "o atendente sabe a senha do profissional" é
 * problema, não comodidade.
 */

/**
 * Sem I, O, 0, 1: a senha vai ser ditada no telefone e digitada por alguém
 * que nunca a viu escrita. Perder 4 símbolos custa pouco (32 em vez de 36 por
 * posição) e evita a ligação de volta perguntando "é i ou um?".
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const GRUPOS = 3;
const POR_GRUPO = 4;

/**
 * Senha nova, em grupos de quatro (7KF3-QM9T-XR4P).
 *
 * 12 posições sobre 32 símbolos são ~60 bits — muito além do que um ataque
 * online alcança, e a senha só vive até a primeira entrada.
 *
 * Usa `crypto.getRandomValues` (Web Crypto), não `randomInt` do `node:crypto`:
 * este módulo também é importado por componente de cliente (o formulário de
 * troca de senha usa TAMANHO_MINIMO_SENHA), e um `import "node:crypto"` aqui
 * quebra o build do webpack inteiro. A Web Crypto existe nos dois lados.
 * `Math.random` está fora de questão — é previsível e não protege nada.
 *
 * Um byte por posição sem viés: 256 é múltiplo exato de 32, então `% 32`
 * reparte os 256 valores em 8 para cada símbolo. Com um alfabeto de tamanho
 * diferente isso deixaria de valer e precisaria de descarte.
 */
export function gerarSenha(): string {
  const bytes = new Uint8Array(GRUPOS * POR_GRUPO);
  crypto.getRandomValues(bytes);

  const grupos: string[] = [];
  for (let g = 0; g < GRUPOS; g++) {
    let grupo = "";
    for (let i = 0; i < POR_GRUPO; i++) grupo += ALFABETO[bytes[g * POR_GRUPO + i] % ALFABETO.length];
    grupos.push(grupo);
  }
  return grupos.join("-");
}

export const TAMANHO_MINIMO_SENHA = 8;

/**
 * Regras da senha que o próprio usuário escolhe.
 *
 * Deliberadamente curtas: exigir maiúscula, número e símbolo empurra as
 * pessoas para "Senha@123" e para o papelzinho colado no monitor. Tamanho é
 * o que realmente importa, e o resto do sistema (acesso desativável na hora,
 * senha provisória que não sobrevive à primeira entrada) cobre o que uma
 * regra de composição não cobriria.
 */
export function conferirSenhaNova(senha: string, confirmacao: string): string | null {
  if (!senha) return "Informe a nova senha.";
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    return `A senha precisa ter ao menos ${TAMANHO_MINIMO_SENHA} caracteres.`;
  }
  if (senha !== confirmacao) return "A confirmação não confere com a nova senha.";
  return null;
}
