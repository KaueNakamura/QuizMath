import equacao1grau from "./perguntas/equacao1grau.js";
import fracoes from "./perguntas/fracoes.js";
import porcentagem from "./perguntas/porcentagem.js";
import regra3 from "./perguntas/regra3.js";
import geometria from "./perguntas/geometria.js";
import problemas from "./perguntas/problemas.js";

const DISTRIBUICAO_PADRAO = {
  facil: 5,
  media: 3,
  dificil: 2,
};

const bancosPorAssunto = {
  equacao1grau,
  fracoes,
  porcentagem,
  regra3,
  geometria,
  problemas,
};

const DIFICULDADE_ALIAS = {
  facil: "facil",
  media: "medio",
  medio: "medio",
  dificil: "dificil",
};

function normalizarDificuldade(dificuldade) {
  return DIFICULDADE_ALIAS[String(dificuldade || "").toLowerCase()] || String(dificuldade || "").toLowerCase();
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function filtrarPorDificuldade(banco, dificuldade) {
  const nivel = normalizarDificuldade(dificuldade);

  if (Array.isArray(banco)) {
    return banco.filter((p) => normalizarDificuldade(p.dificuldade) === nivel);
  }

  if (banco && typeof banco === "object") {
    const lista = banco[nivel] || [];
    return Array.isArray(lista) ? lista : [];
  }

  return [];
}

function selecionarPerguntasPorDificuldade(banco, distribuicao = DISTRIBUICAO_PADRAO) {
  const faceis = embaralhar(filtrarPorDificuldade(banco, "facil")).slice(0, distribuicao.facil);
  const medias = embaralhar(filtrarPorDificuldade(banco, "media")).slice(0, distribuicao.media);
  const dificeis = embaralhar(filtrarPorDificuldade(banco, "dificil")).slice(0, distribuicao.dificil);

  return embaralhar([...faceis, ...medias, ...dificeis]);
}

function montarQuiz(assunto, distribuicao = DISTRIBUICAO_PADRAO) {
  const banco = bancosPorAssunto[assunto] || [];
  return selecionarPerguntasPorDificuldade(banco, distribuicao);
}

function obterAssuntosDisponiveis() {
  return Object.keys(bancosPorAssunto);
}

console.log("QuizMath pronto para evolucao.");
console.log("Assuntos disponiveis:", obterAssuntosDisponiveis());

export {
  DISTRIBUICAO_PADRAO,
  bancosPorAssunto,
  filtrarPorDificuldade,
  selecionarPerguntasPorDificuldade,
  montarQuiz,
  obterAssuntosDisponiveis,
};
