export function SemRecibo({ mensagem, voltar }: { mensagem: string; voltar: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="font-display font-bold text-bordo mb-2">Recibo indisponível</h1>
        <p className="text-sm text-gray-600 mb-4">{mensagem}</p>
        <a href={voltar} className="text-xs font-semibold text-bordo hover:underline">
          ← Voltar
        </a>
      </div>
    </div>
  );
}
