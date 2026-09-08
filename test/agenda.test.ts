import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cabeEmAlgumaJanela,
  haSobreposicao,
  horariosLivres,
  intervaloDe,
  intervalosDeBloqueio,
  janelasDoDia,
  mesclarIntervalos,
  subtrairIntervalos,
} from "../src/lib/agenda";

test("atendimentos que se encostam não conflitam", () => {
  const anterior = intervaloDe("14:00", 60); // 14:00–15:00
  const seguinte = intervaloDe("15:00", 60); // 15:00–16:00
  assert.equal(haSobreposicao(anterior, seguinte), false);
});

test("atendimento que invade o anterior conflita", () => {
  assert.equal(haSobreposicao(intervaloDe("14:00", 60), intervaloDe("14:30", 30)), true);
});

test("janelas encostadas viram uma só, e o serviço longo cabe na emenda", () => {
  const janelas = janelasDoDia(
    [
      { diaSemana: 1, horaInicio: "08:00", horaFim: "12:00" },
      { diaSemana: 1, horaInicio: "12:00", horaFim: "16:00" },
    ],
    1
  );
  assert.deepEqual(mesclarIntervalos(janelas), [{ inicio: 480, fim: 960 }]);
  // 11:30 + 90min = 13:00 — não cabe em nenhum pedaço isolado, cabe na emenda.
  assert.equal(cabeEmAlgumaJanela(intervaloDe("11:30", 90), janelas), true);
});

test("serviço que passa do fim da janela não cabe", () => {
  const janelas = janelasDoDia([{ diaSemana: 3, horaInicio: "08:00", horaFim: "12:00" }], 3);
  assert.equal(cabeEmAlgumaJanela(intervaloDe("11:30", 60), janelas), false);
});

test("disponibilidade de outro dia da semana não conta", () => {
  assert.deepEqual(janelasDoDia([{ diaSemana: 2, horaInicio: "08:00", horaFim: "12:00" }], 3), []);
});

test("bloqueio no meio parte a janela em duas", () => {
  const janelas = [{ inicio: 480, fim: 960 }]; // 08:00–16:00
  const restante = subtrairIntervalos(janelas, intervalosDeBloqueio([{ horaInicio: "12:00", horaFim: "13:00" }]));
  assert.deepEqual(restante, [
    { inicio: 480, fim: 720 },
    { inicio: 780, fim: 960 },
  ]);
});

test("bloqueio sem hora derruba o dia inteiro", () => {
  const restante = subtrairIntervalos(
    [{ inicio: 480, fim: 960 }],
    intervalosDeBloqueio([{ horaInicio: null, horaFim: null }])
  );
  assert.deepEqual(restante, []);
});

test("horários livres respeitam a duração inteira do serviço", () => {
  const livres = horariosLivres({
    janelas: [{ inicio: 480, fim: 600 }], // 08:00–10:00
    ocupacoes: [],
    duracaoMin: 60,
    passoMin: 30,
  });
  // 08:00, 08:30 e 09:00 cabem; 09:30 terminaria 10:30, fora da janela.
  assert.deepEqual(livres, ["08:00", "08:30", "09:00"]);
});

test("horário ocupado some da lista, e os vizinhos que o atravessam também", () => {
  const livres = horariosLivres({
    janelas: [{ inicio: 480, fim: 660 }], // 08:00–11:00
    ocupacoes: [intervaloDe("09:00", 60)], // 09:00–10:00
    duracaoMin: 60,
    passoMin: 30,
  });
  assert.deepEqual(livres, ["08:00", "10:00"]);
});

test("a grade começa em múltiplo do passo, não no minuto quebrado da janela", () => {
  const livres = horariosLivres({
    janelas: [{ inicio: 487, fim: 600 }], // 08:07–10:00
    ocupacoes: [],
    duracaoMin: 30,
    passoMin: 30,
  });
  assert.equal(livres[0], "08:30");
});
