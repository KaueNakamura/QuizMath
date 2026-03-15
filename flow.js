const ROOMS_KEY = "quizmath_rooms_v1";
const RESULTS_HISTORY_KEY = "quizmath_results_history_v1";
let chartInstances = [];
const THEME_LABELS = {
  fracoes: "Fracoes",
  porcentagem: "Porcentagem",
  equacao1grau: "Equacao do 1o grau",
  regra3: "Regra de tres",
  geometria: "Geometria basica",
  problemas: "Problemas de interpretacao",
};
const QUIZ_DISTRIBUTION = { facil: 5, medio: 3, dificil: 2 };

function getRooms() {
  try {
    const rooms = JSON.parse(localStorage.getItem(ROOMS_KEY) || "[]");
    return Array.isArray(rooms) ? rooms : [];
  } catch {
    return [];
  }
}

function saveRooms(rooms) {
  try {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    return true;
  } catch {
    return false;
  }
}

function getResultsHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(RESULTS_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function saveResultsHistory(history) {
  try {
    localStorage.setItem(RESULTS_HISTORY_KEY, JSON.stringify(history.slice(-500)));
    return true;
  } catch {
    return false;
  }
}

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createUniqueCode() {
  const rooms = getRooms();
  let attempts = 0;
  while (attempts < 20) {
    const code = createRoomCode();
    if (!rooms.some((r) => r.code === code)) return code;
    attempts += 1;
  }
  return `${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function findRoomByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  return getRooms().find((r) => r.code === normalized) || null;
}

function updateRoom(updatedRoom) {
  const rooms = getRooms();
  const idx = rooms.findIndex((r) => r.code === updatedRoom.code);
  if (idx >= 0) {
    rooms[idx] = updatedRoom;
    return saveRooms(rooms);
  }
  return false;
}

function deleteRoomByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return false;
  const rooms = getRooms();
  const next = rooms.filter((r) => r.code !== normalized);
  if (next.length === rooms.length) return false;
  return saveRooms(next);
}

function showMessage(element, text, type = "info") {
  if (!element) return;
  element.textContent = text;
  element.className = `status ${type}`;
}

function normalizarNome(nome) {
  return String(nome || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(" ");
}

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function prepararQuizEquacao1Grau() {
  const bancos = window.QUIZMATH_QUESTION_BANKS || {};
  const bank = bancos.equacao1grau;
  if (!bank || typeof bank !== "object") return null;

  const faceis = embaralhar(bank.facil || [])
    .slice(0, QUIZ_DISTRIBUTION.facil)
    .map((q) => ({ ...q, dificuldade: "facil" }));
  const medias = embaralhar(bank.medio || [])
    .slice(0, QUIZ_DISTRIBUTION.medio)
    .map((q) => ({ ...q, dificuldade: "medio" }));
  const dificeis = embaralhar(bank.dificil || [])
    .slice(0, QUIZ_DISTRIBUTION.dificil)
    .map((q) => ({ ...q, dificuldade: "dificil" }));

  if (
    faceis.length < QUIZ_DISTRIBUTION.facil ||
    medias.length < QUIZ_DISTRIBUTION.medio ||
    dificeis.length < QUIZ_DISTRIBUTION.dificil
  ) {
    return null;
  }

  const perguntas = embaralhar([...faceis, ...medias, ...dificeis]);
  return {
    themeKey: "equacao1grau",
    themeLabel: THEME_LABELS.equacao1grau,
    distribution: QUIZ_DISTRIBUTION,
    totalPerguntas: perguntas.length,
    perguntas,
    preparedAt: new Date().toISOString(),
  };
}

function salvarDiagnosticoAluno(roomCode, studentName, diagnostico) {
  const room = findRoomByCode(roomCode);
  if (!room) return false;
  room.studentDiagnostics = room.studentDiagnostics || [];

  const idx = room.studentDiagnostics.findIndex(
    (d) => d.studentName.toLowerCase() === String(studentName).toLowerCase(),
  );

  if (idx >= 0) {
    room.studentDiagnostics[idx] = diagnostico;
  } else {
    room.studentDiagnostics.push(diagnostico);
  }
  const roomSaved = updateRoom(room);
  if (!roomSaved) return false;

  const history = getResultsHistory();
  history.push({
    ...diagnostico,
    roomCode,
    roomName: room.roomName,
    teacherName: room.teacherName,
  });
  saveResultsHistory(history);
  return true;
}

function obterDiagnosticoAluno(room, studentName) {
  const lista = room.studentDiagnostics || [];
  return (
    lista.find((d) => d.studentName.toLowerCase() === String(studentName).toLowerCase()) ||
    null
  );
}

function calcularDiagnostico(quiz, respostas, studentName, tempoSegundos, temposPorQuestao = []) {
  const perguntas = quiz.perguntas || [];
  let acertos = 0;

  const porDificuldade = {
    facil: { total: 0, acertos: 0 },
    medio: { total: 0, acertos: 0 },
    dificil: { total: 0, acertos: 0 },
  };

  const revisao = [];
  const porQuestao = [];

  perguntas.forEach((q, i) => {
    const marcada = Number(respostas[i]);
    const acertou = marcada === q.correta;
    const dif = q.dificuldade || "facil";
    const tempoQuestao = Math.max(0, Math.floor(Number(temposPorQuestao[i] || 0)));

    if (porDificuldade[dif]) porDificuldade[dif].total += 1;
    if (acertou) {
      acertos += 1;
      if (porDificuldade[dif]) porDificuldade[dif].acertos += 1;
    } else {
      revisao.push({
        pergunta: q.pergunta,
        marcada: q.alternativas?.[marcada] || "-",
        correta: q.alternativas?.[q.correta] || "-",
        explicacao: q.explicacao || "Sem explicacao.",
        dificuldade: dif,
      });
    }

    porQuestao.push({
      numero: i + 1,
      pergunta: q.pergunta,
      acertou,
      tempoSegundos: tempoQuestao,
      dificuldade: dif,
    });
  });

  const total = perguntas.length;
  const percentual = total > 0 ? (acertos / total) * 100 : 0;
  const nota = total > 0 ? (acertos / total) * 10 : 0;

  return {
    studentName,
    themeKey: quiz.themeKey,
    themeLabel: quiz.themeLabel,
    total,
    acertos,
    erros: total - acertos,
    percentual: Number(percentual.toFixed(1)),
    nota: Number(nota.toFixed(1)),
    tempoSegundos: Math.max(0, Math.floor(tempoSegundos || 0)),
    porDificuldade,
    porQuestao,
    revisao,
    finishedAt: new Date().toISOString(),
  };
}

function formatarTempo(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos || 0)));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatarDataHora(iso) {
  if (!iso) return "-";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "-";
  return data.toLocaleString("pt-BR");
}

function media(valores) {
  if (!Array.isArray(valores) || !valores.length) return 0;
  return valores.reduce((acc, valor) => acc + Number(valor || 0), 0) / valores.length;
}

function obterHistoricoAluno(studentName) {
  const alvo = normalizarNome(studentName || "");
  return getResultsHistory()
    .filter((item) => normalizarNome(item.studentName || "") === alvo)
    .sort((a, b) => new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime());
}

function destruirGraficos() {
  chartInstances.forEach((instance) => instance.destroy());
  chartInstances = [];
}

function renderizarGrafico(targetId, config) {
  if (typeof Chart === "undefined") return false;
  const canvas = document.getElementById(targetId);
  if (!canvas) return false;

  const instance = new Chart(canvas, config);
  chartInstances.push(instance);
  return true;
}

function renderGraficoAlunoProfessor(diag, target) {
  if (!target) return;
  const historico = obterHistoricoAluno(diag.studentName);
  const labels = historico.map((_, index) => `Tentativa ${index + 1}`);
  const percentuais = historico.map((item) => Number(item.percentual || 0));

  target.innerHTML = `
    <div class="card stack">
      <h2>Grafico de ${diag.studentName}</h2>
      <div class="chart-wrap">
        <canvas id="studentChart" height="120"></canvas>
      </div>
      <div class="item"><strong>Tentativas registradas:</strong> ${historico.length}</div>
      <div class="item"><strong>Acertos atuais:</strong> ${diag.acertos}/${diag.total}</div>
      <div class="item"><strong>Percentual:</strong> ${diag.percentual}%</div>
      <div class="item"><strong>Tempo:</strong> ${formatarTempo(diag.tempoSegundos)}</div>
    </div>
  `;

  const ok = renderizarGrafico("studentChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Acertos em %",
          data: percentuais,
          borderColor: "#5d8fda",
          backgroundColor: "rgba(93, 143, 218, 0.18)",
          fill: true,
          tension: 0.28,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#f5f7ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });

  if (!ok) {
    const wrap = target.querySelector(".chart-wrap");
    if (wrap) wrap.innerHTML = '<div class="item">Biblioteca de grafico nao carregou.</div>';
  }
}

function renderGraficoTurma(room, target) {
  if (!target) return;
  const lista = room.studentDiagnostics || [];

  if (!lista.length) {
    target.innerHTML = '<div class="card">Nenhum resultado disponivel para a turma ainda.</div>';
    return;
  }

  const notas = lista.map((d) => Number(d.nota || 0));
  const percentuais = lista.map((d) => Number(d.percentual || 0));
  const tempos = lista.map((d) => Number(d.tempoSegundos || 0));
  const porQuestaoBase = lista[0]?.porQuestao || [];
  const questoes = porQuestaoBase.map((q) => `Q${q.numero}`);
  const acertoPorQuestao = questoes.map((_, idx) => {
    const totalAcertos = lista.reduce(
      (acc, diag) => acc + (diag.porQuestao?.[idx]?.acertou ? 1 : 0),
      0,
    );
    return lista.length ? Number(((totalAcertos / lista.length) * 100).toFixed(1)) : 0;
  });
  const tempoMedioPorQuestao = questoes.map((_, idx) => {
    const soma = lista.reduce(
      (acc, diag) => acc + Number(diag.porQuestao?.[idx]?.tempoSegundos || 0),
      0,
    );
    return lista.length ? Number((soma / lista.length).toFixed(1)) : 0;
  });
  const questaoMaisDificilIndex = acertoPorQuestao.indexOf(Math.min(...acertoPorQuestao));
  const questaoMaisFacilIndex = acertoPorQuestao.indexOf(Math.max(...acertoPorQuestao));

  const faixas = [
    { label: "0-2", min: 0, max: 2.99 },
    { label: "3-4", min: 3, max: 4.99 },
    { label: "5-6", min: 5, max: 6.99 },
    { label: "7-8", min: 7, max: 8.99 },
    { label: "9-10", min: 9, max: 10 },
  ];
  const distribuicaoNotas = faixas.map((faixa) => (
    lista.filter((diag) => {
      const nota = Number(diag.nota || 0);
      return nota >= faixa.min && nota <= faixa.max;
    }).length
  ));
  const mediaNotas = media(notas);
  const maiorNota = notas.length ? Math.max(...notas) : 0;
  const menorNota = notas.length ? Math.min(...notas) : 0;

  target.innerHTML = `
    <div class="card stack">
      <h2>Distribuicao de notas</h2>
      <div class="chart-wrap">
        <canvas id="gradeDistributionChart" height="120"></canvas>
      </div>
      <div class="item"><strong>Media da turma:</strong> ${mediaNotas.toFixed(1)}</div>
      <div class="item"><strong>Maior nota:</strong> ${maiorNota.toFixed(1)}</div>
      <div class="item"><strong>Menor nota:</strong> ${menorNota.toFixed(1)}</div>
      <div class="item"><strong>Alunos:</strong> ${lista.length}</div>
      <div class="item"><strong>Media de tempo:</strong> ${formatarTempo(media(tempos))}</div>
    </div>

    <div class="card stack">
      <h2>Acerto por questao</h2>
      <div class="chart-wrap">
        <canvas id="questionAccuracyChart" height="120"></canvas>
      </div>
      <div class="item"><strong>Questao mais errada:</strong> ${questoes[questaoMaisDificilIndex] || "-"} (${acertoPorQuestao[questaoMaisDificilIndex] || 0}% acerto)</div>
      <div class="item"><strong>Questao mais facil:</strong> ${questoes[questaoMaisFacilIndex] || "-"} (${acertoPorQuestao[questaoMaisFacilIndex] || 0}% acerto)</div>
    </div>

    <div class="card stack">
      <h2>Tempo medio por questao</h2>
      <div class="chart-wrap">
        <canvas id="questionTimeChart" height="120"></canvas>
      </div>
      <div class="item"><strong>Questao com maior tempo medio:</strong> ${questoes[tempoMedioPorQuestao.indexOf(Math.max(...tempoMedioPorQuestao))] || "-"}</div>
      <div class="item"><strong>Questao com menor tempo medio:</strong> ${questoes[tempoMedioPorQuestao.indexOf(Math.min(...tempoMedioPorQuestao))] || "-"}</div>
    </div>
  `;

  const gradeOk = renderizarGrafico("gradeDistributionChart", {
    type: "bar",
    data: {
      labels: faixas.map((faixa) => faixa.label),
      datasets: [
        {
          label: "Quantidade de alunos",
          data: distribuicaoNotas,
          backgroundColor: "rgba(93, 143, 218, 0.75)",
          borderColor: "#5d8fda",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#f5f7ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
  const accuracyOk = renderizarGrafico("questionAccuracyChart", {
    type: "bar",
    data: {
      labels: questoes,
      datasets: [
        {
          label: "Acerto (%)",
          data: acertoPorQuestao,
          backgroundColor: "rgba(88, 173, 113, 0.75)",
          borderColor: "#58ad71",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#f5f7ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });
  const timeOk = renderizarGrafico("questionTimeChart", {
    type: "bar",
    data: {
      labels: questoes,
      datasets: [
        {
          label: "Tempo medio (s)",
          data: tempoMedioPorQuestao,
          backgroundColor: "rgba(255, 209, 102, 0.75)",
          borderColor: "#ffd166",
          borderWidth: 1,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#f5f7ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
        y: {
          beginAtZero: true,
          ticks: { color: "#b4c3e8" },
          grid: { color: "rgba(255,255,255,0.08)" },
        },
      },
    },
  });

  if (!gradeOk || !accuracyOk || !timeOk) {
    target.querySelectorAll(".chart-wrap").forEach((wrap) => {
      wrap.innerHTML = '<div class="item">Biblioteca de grafico nao carregou.</div>';
    });
  }
}

function setupProfessorPage() {
  const form = document.getElementById("professorForm");
  if (!form) return;

  const feedback = document.getElementById("feedback");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const professorName = normalizarNome(document.getElementById("professorName").value);
    const roomName = document.getElementById("roomName").value.trim();

    if (!professorName || !roomName) {
      showMessage(feedback, "Preencha nome do professor e nome da sala.", "err");
      return;
    }

    const preparedQuiz = prepararQuizEquacao1Grau();
    if (!preparedQuiz) {
      showMessage(feedback, "Nao foi possivel preparar o teste agora.", "err");
      return;
    }

    const code = createUniqueCode();
    const rooms = getRooms();
    rooms.push({
      code,
      roomName,
      teacherName: professorName,
      students: [],
      selectedTheme: "equacao1grau",
      preparedQuiz,
      started: false,
      createdAt: new Date().toISOString(),
    });

    if (!saveRooms(rooms)) {
      showMessage(feedback, "Nao foi possivel criar a sala. Verifique as permissoes do navegador.", "err");
      return;
    }

    window.location.href = `./lobby.html?code=${encodeURIComponent(code)}`;
  });
}

function renderStudentsList(students, target) {
  if (!target) return;
  if (!students.length) {
    target.innerHTML = '<div class="item">Nenhum aluno conectado ainda.</div>';
    return;
  }
  target.innerHTML = students.map((s) => `<div class="item">${s.name}</div>`).join("");
}

function setupLobbyPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const room = findRoomByCode(code);

  const feedback = document.getElementById("feedback");
  if (!room) {
    showMessage(feedback, "Sala nao encontrada.", "err");
    return;
  }

  document.getElementById("roomNameView").textContent = room.roomName;
  document.getElementById("teacherNameView").textContent = room.teacherName;
  document.getElementById("roomCodeView").textContent = room.code;
  renderStudentsList(room.students || [], document.getElementById("studentsList"));

  const startBtn = document.getElementById("startActivityBtn");
  startBtn.addEventListener("click", () => {
    const freshRoom = findRoomByCode(room.code);
    if (!freshRoom) {
      showMessage(feedback, "Sala nao encontrada.", "err");
      return;
    }
    if (!freshRoom.selectedTheme || !freshRoom.preparedQuiz) {
      showMessage(feedback, "Nao ha teste preparado para esta sala.", "err");
      return;
    }
    freshRoom.started = true;
    updateRoom(freshRoom);
    window.location.href = `./quiz.html?code=${encodeURIComponent(freshRoom.code)}&role=professor`;
  });

  const deleteBtn = document.getElementById("deleteRoomBtn");
  deleteBtn.addEventListener("click", () => {
    const confirmed = window.confirm("Tem certeza que deseja deletar esta sala?");
    if (!confirmed) return;
    const removed = deleteRoomByCode(room.code);
    if (!removed) {
      showMessage(feedback, "Nao foi possivel deletar a sala.", "err");
      return;
    }
    window.location.href = "../index.html";
  });

  setInterval(() => {
    const refreshed = findRoomByCode(room.code);
    if (!refreshed) return;
    renderStudentsList(refreshed.students || [], document.getElementById("studentsList"));
  }, 1200);
}

function setupAlunoPage() {
  const form = document.getElementById("alunoForm");
  if (!form) return;

  const feedback = document.getElementById("feedback");
  let pollingId = null;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const studentName = normalizarNome(document.getElementById("studentName").value);
    const roomCode = document.getElementById("roomCode").value.trim().toUpperCase();

    if (!studentName || !roomCode) {
      showMessage(feedback, "Preencha nome do aluno e codigo da sala.", "err");
      return;
    }

    const room = findRoomByCode(roomCode);
    if (!room) {
      showMessage(feedback, "Codigo invalido.", "err");
      return;
    }

    const alreadyConnected = (room.students || []).some(
      (s) => s.name.toLowerCase() === studentName.toLowerCase(),
    );
    if (!alreadyConnected) {
      room.students = room.students || [];
      room.students.push({ name: studentName, joinedAt: new Date().toISOString() });
      if (!updateRoom(room)) {
        showMessage(feedback, "Nao foi possivel entrar na sala. Tente novamente.", "err");
        return;
      }
    }

    showMessage(feedback, `Voce entrou na sala ${room.roomName} (${room.code}).`, "ok");
    form.style.display = "none";

    if (pollingId) clearInterval(pollingId);
    pollingId = setInterval(() => {
      const refreshed = findRoomByCode(room.code);
      if (!refreshed) {
        clearInterval(pollingId);
        showMessage(feedback, "Sala foi encerrada.", "err");
        form.style.display = "grid";
        return;
      }
      if (refreshed.started) {
        clearInterval(pollingId);
        window.location.href =
          `./quiz.html?code=${encodeURIComponent(refreshed.code)}&role=aluno&student=${encodeURIComponent(studentName)}`;
      }
    }, 1200);
  });
}

function setupSalasPage() {
  const target = document.getElementById("roomsList");
  if (!target) return;

  const rooms = getRooms()
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (!rooms.length) {
    target.innerHTML = '<div class="card">Nenhuma sala criada ainda.</div>';
    return;
  }

  target.innerHTML = rooms
    .map(
      (room) => `
        <div class="card stack">
          <div class="item"><strong>Nome da sala:</strong> ${room.roomName || "-"}</div>
          <div class="item"><strong>Professor:</strong> ${room.teacherName || "-"}</div>
          <div class="item"><strong>Data de criacao:</strong> ${formatarDataHora(room.createdAt)}</div>
          <div class="item"><strong>Codigo:</strong> ${room.code || "-"}</div>
          <div class="actions">
            <a class="btn ok" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor&view=class">Ver graficos da turma</a>
            <button class="btn err delete-room-btn" type="button" data-code="${room.code}">Deletar sala</button>
          </div>
        </div>
      `,
    )
    .join("");

  target.querySelectorAll(".delete-room-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.code;
      const confirmed = window.confirm("Tem certeza que deseja deletar esta sala?");
      if (!confirmed) return;
      const removed = deleteRoomByCode(code);
      if (!removed) {
        showMessage(target, "Nao foi possivel deletar a sala.", "err");
        return;
      }
      setupSalasPage();
    });
  });
}

function renderQuizAluno(room, studentName, role) {
  const quiz = room.preparedQuiz;
  const content = document.getElementById("quizContent");
  if (!quiz || !Array.isArray(quiz.perguntas) || !quiz.perguntas.length) {
    content.innerHTML = '<div class="card">Nao ha quiz preparado para esta sala.</div>';
    return;
  }

  let indice = 0;
  const respostas = [];
  const inicio = Date.now();
  const temposPorQuestao = [];
  let inicioQuestao = Date.now();

  function renderPergunta() {
    const q = quiz.perguntas[indice];
    const progresso = `Pergunta ${indice + 1} de ${quiz.perguntas.length}`;
    const opcoes = (q.alternativas || [])
      .map((alt, i) => `<button class="btn option-btn" type="button" data-idx="${i}">${alt}</button>`)
      .join("");

    content.innerHTML = `
      <div class="card stack">
        <div class="item"><strong>${progresso}</strong> | Dificuldade: ${q.dificuldade}</div>
        <div class="question-text">${q.pergunta}</div>
        <div class="options-grid">${opcoes}</div>
      </div>
    `;

    document.querySelectorAll(".option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        temposPorQuestao[indice] = (Date.now() - inicioQuestao) / 1000;
        respostas[indice] = Number(btn.dataset.idx);
        indice += 1;

        if (indice >= quiz.perguntas.length) {
          const tempo = (Date.now() - inicio) / 1000;
          const diagnostico = calcularDiagnostico(quiz, respostas, studentName, tempo, temposPorQuestao);
          salvarDiagnosticoAluno(room.code, studentName, diagnostico);

          window.location.href =
            `./resultado.html?code=${encodeURIComponent(room.code)}&role=${encodeURIComponent(role)}&student=${encodeURIComponent(studentName)}`;
          return;
        }

        inicioQuestao = Date.now();
        renderPergunta();
      });
    });
  }

  renderPergunta();
}

function setupQuizPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const role = params.get("role");
  const student = params.get("student");
  const room = findRoomByCode(code);

  const title = document.getElementById("quizTitle");
  const subtitle = document.getElementById("quizSubtitle");
  const details = document.getElementById("quizDetails");

  if (!room) {
    title.textContent = "Sala nao encontrada";
    subtitle.textContent = "Volte e entre novamente em uma sala valida.";
    return;
  }

  title.textContent = `Quiz da sala ${room.roomName}`;
  subtitle.textContent = room.started
    ? "Atividade iniciada. Responda as perguntas abaixo."
    : "Aguardando inicio da atividade.";

  details.innerHTML = `
    <div class="item"><strong>Professor:</strong> ${room.teacherName}</div>
    <div class="item"><strong>Codigo:</strong> ${room.code}</div>
    <div class="item"><strong>Tema:</strong> ${THEME_LABELS[room.selectedTheme] || "-"}</div>
    <div class="item"><strong>Perfil:</strong> ${role || "-"}</div>
    <div class="item"><strong>Aluno:</strong> ${student || "-"}</div>
  `;

  if (role === "aluno") {
    renderQuizAluno(room, student, role);
    return;
  }

  document.getElementById("quizContent").innerHTML = `
    <div class="card stack">
      <div class="item">Atividade iniciada para os alunos.</div>
      <div class="item">Use esta tela para acompanhar e depois ver os diagnosticos.</div>
      <div class="actions">
        <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor">Ver diagnosticos</a>
      </div>
    </div>
  `;
}

function setupResultadoPage() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const role = params.get("role");
  const student = params.get("student");
  const view = params.get("view");
  const room = findRoomByCode(code);

  const title = document.getElementById("resultTitle");
  const subtitle = document.getElementById("resultSubtitle");
  const content = document.getElementById("resultContent");

  if (!room) {
    title.textContent = "Resultado";
    subtitle.textContent = "Sala nao encontrada.";
    return;
  }

  if (role === "professor") {
    const lista = room.studentDiagnostics || [];
    const totalAlunos = (room.students || []).length;
    const totalDiagnosticos = lista.length;
    title.textContent = `Diagnosticos da sala ${room.roomName}`;
    subtitle.textContent = `Professor: ${room.teacherName}`;

    if (view === "ranking") {
      if (!lista.length) {
        content.innerHTML = '<div class="card">Nenhum diagnostico disponivel ainda.</div>';
        return;
      }

      const ranking = [...lista].sort(
        (a, b) => b.percentual - a.percentual || a.tempoSegundos - b.tempoSegundos || a.studentName.localeCompare(b.studentName),
      );

      content.innerHTML = `
        <div class="card stack">
          <div class="item"><strong>Total de alunos:</strong> ${totalAlunos}</div>
          <div class="item"><strong>Diagnosticos recebidos:</strong> ${totalDiagnosticos}</div>
        </div>
        <div class="card stack">
          ${ranking
            .map(
              (d, i) => `
              <div class="item">
                <strong>${i + 1}o</strong> - ${d.studentName} | ${d.acertos}/${d.total} (${d.percentual}%) | Tempo ${formatarTempo(d.tempoSegundos)}
              </div>
            `,
            )
            .join("")}
        </div>
        <div class="actions">
          <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor">Voltar para os alunos</a>
        </div>
      `;
      return;
    }

    if (!lista.length) {
      content.innerHTML = '<div class="card">Nenhum diagnostico disponivel ainda.</div>';
      return;
    }

    if (view === "class") {
      renderGraficoTurma(room, content);
      content.insertAdjacentHTML(
        "beforeend",
        `
          <div class="actions">
            <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor">Voltar para os alunos</a>
          </div>
        `,
      );
      return;
    }

    if (student) {
      const diagAluno = obterDiagnosticoAluno(room, student);
      title.textContent = `Grafico do aluno`;
      subtitle.textContent = `${student} - ${room.roomName}`;

      if (!diagAluno) {
        content.innerHTML = '<div class="card">Resultado do aluno nao encontrado.</div>';
        return;
      }

      renderGraficoAlunoProfessor(diagAluno, content);
      content.insertAdjacentHTML(
        "beforeend",
        `
          <div class="actions">
            <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor">Voltar para os alunos</a>
          </div>
        `,
      );
      return;
    }

    content.innerHTML = `
      <div class="card stack">
        <div class="item"><strong>Total de alunos:</strong> ${totalAlunos}</div>
        <div class="item"><strong>Diagnosticos recebidos:</strong> ${totalDiagnosticos}</div>
      </div>
      <div class="card stack">
        ${lista
          .map(
            (d) => `
            <div class="item">
              <div><strong>${d.studentName}</strong> | ${d.acertos}/${d.total} (${d.percentual}%) | Tempo ${formatarTempo(d.tempoSegundos)}</div>
              <div class="inline-actions">
                <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor&student=${encodeURIComponent(d.studentName)}">Ver grafico</a>
              </div>
            </div>
          `,
          )
          .join("")}
      </div>
      <div class="actions">
        <a class="btn" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor&view=ranking">Ver ranking</a>
        <a class="btn ok" href="./resultado.html?code=${encodeURIComponent(room.code)}&role=professor&view=class">Ver estatisticas da turma</a>
      </div>
    `;
    return;
  }

  const diag = obterDiagnosticoAluno(room, student);
  title.textContent = "Diagnostico do aluno";
  subtitle.textContent = `${student || "Aluno"} - ${room.roomName}`;

  if (!diag) {
    content.innerHTML = '<div class="card">Diagnostico ainda nao encontrado.</div>';
    return;
  }

  const revHtml = diag.revisao.length
    ? diag.revisao
      .map(
        (r, i) => `
      <div class="card stack">
        <div class="item"><strong>Questao ${i + 1} (${r.dificuldade})</strong></div>
        <div class="item"><strong>Pergunta:</strong> ${r.pergunta}</div>
        <div class="item"><strong>Sua resposta:</strong> ${r.marcada}</div>
        <div class="item"><strong>Correta:</strong> ${r.correta}</div>
        <div class="item"><strong>Explicacao:</strong> ${r.explicacao}</div>
      </div>
    `,
      )
      .join("")
    : '<div class="card">Parabens. Voce nao teve erros nesta atividade.</div>';

  content.innerHTML = `
    <div class="card stack">
      <div class="item"><strong>Tema:</strong> ${diag.themeLabel}</div>
      <div class="item"><strong>Acertos:</strong> ${diag.acertos}</div>
      <div class="item"><strong>Total:</strong> ${diag.total}</div>
      <div class="item"><strong>Percentual:</strong> ${diag.percentual}%</div>
      <div class="item"><strong>Tempo:</strong> ${formatarTempo(diag.tempoSegundos)}</div>
    </div>

    <div class="stack">
      <h2>Revisao das questoes erradas</h2>
      ${revHtml}
    </div>
  `;
}

function initFlow() {
  destruirGraficos();
  const page = document.body.dataset.page;
  if (page === "professor") setupProfessorPage();
  if (page === "lobby") setupLobbyPage();
  if (page === "aluno") setupAlunoPage();
  if (page === "salas") setupSalasPage();
  if (page === "quiz") setupQuizPage();
  if (page === "resultado") setupResultadoPage();
}

document.addEventListener("DOMContentLoaded", initFlow);
