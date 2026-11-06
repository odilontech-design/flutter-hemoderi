/**
 * Ícones de ação da esteira (traço, 16 px, herdam a cor do texto). Um botão
 * com ícone se reconhece sem ler — pedido de 06/11: botões modernos e
 * intuitivos no cartão do agendamento.
 */
type P = { className?: string };

function Base({ children, className = "" }: P & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const IconeWhatsapp = (p: P) => (
  <Base {...p}>
    <path d="M3 21l1.65-4.85A8.5 8.5 0 1 1 8 19.4L3 21z" />
    <path d="M9 10c.3 2 2 3.7 4.2 4.4l1.3-1.3 2 .8c0 1-.8 1.6-1.8 1.6C10.5 15.5 7.5 12.500 7.500 9.600c0-1 .6-1.800 1.600-1.800l.8 2L9 10z" />
  </Base>
);
export const IconeCheck = (p: P) => (
  <Base {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Base>
);
export const IconeX = (p: P) => (
  <Base {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Base>
);
export const IconeRelogio = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Base>
);
export const IconeCalendario = (p: P) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M16 3v4M8 3v4M3 11h18" />
  </Base>
);
export const IconeUsuarioMais = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2M19 8v6M16 11h6" />
  </Base>
);
export const IconeUsuarioMenos = (p: P) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11h6" />
  </Base>
);
export const IconeUsuario = (p: P) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21v-1a7 7 0 0 1 16 0v1" />
  </Base>
);
export const IconeLixo = (p: P) => (
  <Base {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Base>
);
export const IconeEnviar = (p: P) => (
  <Base {...p}>
    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
  </Base>
);
export const IconeMapa = (p: P) => (
  <Base {...p}>
    <path d="M12 21s7-6.500 7-12a7 7 0 1 0-14 0c0 5.500 7 12 7 12z" />
    <circle cx="12" cy="9" r="2.500" />
  </Base>
);
export const IconeAtualizar = (p: P) => (
  <Base {...p}>
    <path d="M21 12a9 9 0 1 1-3-6.700L21 8M21 3v5h-5" />
  </Base>
);
