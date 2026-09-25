/**
 * Ícones do menu lateral — traço fino (Lucide-like), sempre em `currentColor`.
 *
 * Nunca branco fixo: o item ativo troca o fundo para branco e o texto para
 * bordô (ver MenuLateral.tsx), e um ícone travado em branco sumiria ali. Com
 * `currentColor` ele segue a cor do texto — branco no item normal (o efeito
 * pedido), bordô no item ativo (o contraste que o item ativo precisa).
 */

type Props = { className?: string };

const BASE = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconeHoje({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function IconeAgendamentos({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

export function IconePedidosSite({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

export function IconeAgenda({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

export function IconeClinicas({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function IconeProfissionais({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function IconeCatalogo({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconeFinanceiro({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2h-4a3 3 0 0 0 0 6h4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconeAcessos({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.8 12.2 7.7-7.7M17 6l2 2M20 3l1 1" />
    </svg>
  );
}

export function IconeDisponibilidade({ className }: Props) {
  return (
    <svg {...BASE} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}
