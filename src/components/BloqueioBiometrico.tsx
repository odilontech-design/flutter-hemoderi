"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { CHAVE_DO_BLOQUEIO, bloqueioLigado, precisaBloquear } from "@/lib/bloqueio-biometrico";
import { desregistrarAparelho } from "@/lib/ponte-app";

const useLayoutSeguro = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Estado = "livre" | "bloqueado";

/**
 * Entrada por digital ou Face ID (proposta do app). Só age dentro do app:
 * ao abrir e ao voltar do segundo plano depois de 30 segundos, cobre a tela
 * e pede a biometria do aparelho (com a senha do celular como alternativa).
 * Enquanto o app está em segundo plano, a tela fica coberta no alternador de
 * apps, para não mostrar atendimento e paciente.
 *
 * Aparelho sem biometria nem senha de tela não é travado: não há como
 * identificar a pessoa, e prender o usuário fora do app seria pior.
 */
export function BloqueioBiometrico() {
  const [estado, setEstado] = useState<Estado>("livre");
  const [cobertoNoSegundoPlano, setCobertoNoSegundoPlano] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [nativo, setNativo] = useState(false);
  const saiuEm = useRef<number | null>(null);
  const autenticando = useRef(false);
  // O prompt da biometria faz o app ir ao segundo plano e voltar: esses eventos
  // não contam como "saiu do app" (era o que travava o app num laço).
  const autenticouEm = useRef(0);

  const desbloquear = useCallback(async () => {
    if (autenticando.current) return;
    autenticando.current = true;
    setMensagem("");
    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({
        reason: "Desbloquear o app da Hemoderi",
        cancelTitle: "Cancelar",
        allowDeviceCredential: true,
        iosFallbackTitle: "Usar a senha do celular",
        androidTitle: "Hemoderi",
        androidSubtitle: "Confirme que é você",
      });
      saiuEm.current = null;
      autenticouEm.current = Date.now();
      setEstado("livre");
    } catch {
      setMensagem("Não foi possível confirmar. Toque em Desbloquear para tentar de novo.");
    } finally {
      autenticouEm.current = Date.now();
      autenticando.current = false;
    }
  }, []);

  const bloquearSePreciso = useCallback(async (primeiraVez: boolean) => {
    // Voltou sem nunca ter saído (ou logo depois do prompt): nada a pedir.
    if (!primeiraVez && saiuEm.current === null) return;
    let ligado = true;
    try {
      ligado = bloqueioLigado(window.localStorage.getItem(CHAVE_DO_BLOQUEIO));
    } catch {
      // sem armazenamento: vale o padrão (ligado)
    }
    if (!precisaBloquear({ ligado, saiuEm: primeiraVez ? null : saiuEm.current, agora: Date.now() })) return;
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    const biometria = await BiometricAuth.checkBiometry();
    if (!biometria.isAvailable && !biometria.deviceIsSecure) return;
    setEstado("bloqueado");
    void desbloquear();
  }, [desbloquear]);

  // Antes de pintar: dentro do app a tela já nasce coberta, sem piscar o conteúdo.
  useLayoutSeguro(() => {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    setNativo(true);
    let ligado = true;
    try {
      ligado = bloqueioLigado(window.localStorage.getItem(CHAVE_DO_BLOQUEIO));
    } catch {
      // padrão
    }
    if (ligado) setEstado("bloqueado");
  }, []);

  useEffect(() => {
    if (!nativo) return;
    let encerrado = false;
    const removedores: (() => void)[] = [];
    (async () => {
      try {
        await bloquearSePreciso(true);
        // Se o aparelho não tem como autenticar, não deixa a tela coberta.
        if (!encerrado) {
          const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
          const b = await BiometricAuth.checkBiometry();
          if (!b.isAvailable && !b.deviceIsSecure) setEstado("livre");
        }
        const { App } = await import("@capacitor/app");
        const ouvinte = await App.addListener("appStateChange", ({ isActive }) => {
          // Eventos causados pelo próprio prompt de biometria não valem.
          if (autenticando.current || Date.now() - autenticouEm.current < 2500) return;
          if (!isActive) {
            saiuEm.current = Date.now();
            setCobertoNoSegundoPlano(true);
          } else {
            setCobertoNoSegundoPlano(false);
            void bloquearSePreciso(false);
          }
        });
        removedores.push(() => void ouvinte.remove());
      } catch (erro) {
        console.error("bloqueio biometrico", erro);
        setEstado("livre");
      }
    })();
    return () => {
      encerrado = true;
      removedores.forEach((r) => r());
    };
  }, [nativo, bloquearSePreciso]);

  if (!nativo || (estado === "livre" && !cobertoNoSegundoPlano)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="App bloqueado"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-4 bg-[#6E2620] p-6 text-center text-white"
    >
      <div className="font-display text-3xl font-bold">Hemoderi</div>
      {estado === "bloqueado" && (
        <>
          <p className="max-w-xs text-sm text-white/80">Confirme com a sua digital, o Face ID ou a senha do celular para abrir o app.</p>
          {mensagem && <p className="max-w-xs text-xs text-amber-200">{mensagem}</p>}
          <button
            type="button"
            onClick={() => void desbloquear()}
            className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#6E2620]"
          >
            Desbloquear
          </button>
          <button
            type="button"
            onClick={async () => {
              await desregistrarAparelho();
              void signOut({ callbackUrl: "/login" });
            }}
            className="text-xs text-white/70 underline"
          >
            Sair da conta
          </button>
        </>
      )}
    </div>
  );
}
