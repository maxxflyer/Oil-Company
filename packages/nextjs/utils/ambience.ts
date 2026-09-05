/**
 * Il sottofondo del sito, suonato dal browser.
 *
 * Non c'è nessun file audio: le voci nascono da oscillatori e da rumore, e uno
 * spartito le programma un ciclo alla volta. Così pesa zero, non si scarica
 * niente, e ogni sito della compagnia può avere il suo carattere cambiando i
 * numeri qui sotto.
 */

/** Quanto dura un giro completo dello spartito. */
export const CICLO = 16;

/// La coda di un ambiente: rumore che si spegne, usato come impronta del riverbero.
const codaRiverbero = (ctx: BaseAudioContext, secondi: number, decadimento: number) => {
  const n = Math.floor(ctx.sampleRate * secondi);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const dati = buf.getChannelData(c);
    for (let i = 0; i < n; i++) dati[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decadimento);
  }
  return buf;
};

/// Due secondi di rumore da far girare in tondo: è la materia dei colpi e dei soffi.
const rumore = (ctx: BaseAudioContext) => {
  const n = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const dati = buf.getChannelData(0);
  for (let i = 0; i < n; i++) dati[i] = Math.random() * 2 - 1;
  return buf;
};

export type Ambiente = {
  ctx: BaseAudioContext;
  /** Programma un giro di spartito che comincia a `t0`. */
  giro: (t0: number) => void;
};

/**
 * La compagnia petrolifera: un motore pesante che gira nel sottosuolo.
 *
 * Un bordone in LA con la sua quinta, una pompa che batte ogni due secondi, e
 * ogni tanto una goccia metallica che cade in una stanza grande.
 */
export const costruisci = (ctx: BaseAudioContext, uscita: AudioNode): Ambiente => {
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(uscita);

  const riverbero = ctx.createConvolver();
  riverbero.buffer = codaRiverbero(ctx, 4.5, 2.4);
  const mandaRiverbero = ctx.createGain();
  mandaRiverbero.gain.value = 0.35;
  mandaRiverbero.connect(riverbero);
  riverbero.connect(master);

  const materia = rumore(ctx);

  // ── Il bordone: LA grave, la sua quinta, e un filtro che respira ──────────
  const bordone = ctx.createGain();
  bordone.gain.value = 0.11;
  const colore = ctx.createBiquadFilter();
  colore.type = "lowpass";
  colore.frequency.value = 260;
  colore.Q.value = 3;
  bordone.connect(colore);
  colore.connect(master);
  colore.connect(mandaRiverbero);

  for (const [hz, forma, peso] of [
    [55, "sawtooth", 0.5],
    [82.5, "triangle", 0.3],
    [110, "sine", 0.22],
  ] as const) {
    const o = ctx.createOscillator();
    o.type = forma;
    o.frequency.value = hz;
    // Due voci quasi uguali battono l'una contro l'altra: è quel che tiene vivo il bordone.
    const detune = ctx.createOscillator();
    detune.frequency.value = 0.07;
    const quanto = ctx.createGain();
    quanto.gain.value = 6;
    detune.connect(quanto);
    quanto.connect(o.detune);
    const g = ctx.createGain();
    g.gain.value = peso;
    o.connect(g);
    g.connect(bordone);
    o.start();
    detune.start();
  }

  // Il respiro del filtro, lentissimo.
  const respiro = ctx.createOscillator();
  respiro.frequency.value = 1 / 23;
  const ampiezza = ctx.createGain();
  ampiezza.gain.value = 150;
  respiro.connect(ampiezza);
  ampiezza.connect(colore.frequency);
  respiro.start();

  // ── Il soffio di fondo: aria che passa in un tubo ─────────────────────────
  const soffio = ctx.createBufferSource();
  soffio.buffer = materia;
  soffio.loop = true;
  const tubo = ctx.createBiquadFilter();
  tubo.type = "bandpass";
  tubo.frequency.value = 420;
  tubo.Q.value = 0.7;
  const quantoSoffio = ctx.createGain();
  quantoSoffio.gain.value = 0.014;
  soffio.connect(tubo);
  tubo.connect(quantoSoffio);
  quantoSoffio.connect(master);
  soffio.start();

  const ondaSoffio = ctx.createOscillator();
  ondaSoffio.frequency.value = 1 / 17;
  const ampSoffio = ctx.createGain();
  ampSoffio.gain.value = 0.009;
  ondaSoffio.connect(ampSoffio);
  ampSoffio.connect(quantoSoffio.gain);
  ondaSoffio.start();

  /// Un colpo di pompa: un tonfo grave più uno sbuffo di rumore.
  const pompa = (t: number, forza: number) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.22);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * forza, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.6);

    const s = ctx.createBufferSource();
    s.buffer = materia;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.setValueAtTime(1800, t);
    f.frequency.exponentialRampToValueAtTime(320, t + 0.3);
    f.Q.value = 1.2;
    const gs = ctx.createGain();
    gs.gain.setValueAtTime(0.0001, t);
    gs.gain.exponentialRampToValueAtTime(0.12 * forza, t + 0.008);
    gs.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f);
    f.connect(gs);
    gs.connect(master);
    gs.connect(mandaRiverbero);
    s.start(t);
    s.stop(t + 0.4);
  };

  /// Una goccia: metallo che cade lontano.
  const goccia = (t: number, hz: number) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.075, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g);
    g.connect(master);
    g.connect(mandaRiverbero);
    o.start(t);
    o.stop(t + 1.7);
  };

  // La scala su cui cadono le gocce: LA minore, senza mai risolvere.
  const scala = [880, 1046.5, 1174.7, 1318.5, 1567.98];

  const giro = (t0: number) => {
    // La pompa: ogni due secondi, con un colpo più forte all'inizio del giro.
    for (let i = 0; i < CICLO / 2; i++) pompa(t0 + i * 2, i % 4 === 0 ? 1 : 0.62);
    // Le gocce cadono fuori tempo, su tre punti diversi del giro.
    goccia(t0 + 1.37, scala[0]);
    goccia(t0 + 5.9, scala[3]);
    goccia(t0 + 9.15, scala[1]);
    goccia(t0 + 12.6, scala[4]);
    goccia(t0 + 13.05, scala[2]);
  };

  return { ctx, giro };
};
