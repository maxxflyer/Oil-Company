"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { CICLO, costruisci } from "~~/utils/ambience";

const RICORDO = "ambience";

/**
 * L'interruttore del sottofondo.
 *
 * Il suono lo fa il browser, un ciclo alla volta: mentre suona il giro in corso
 * si programma il successivo. Il browser non lascia partire niente prima che
 * qualcuno tocchi la pagina, quindi qui si comincia solo da un clic — e se era
 * acceso l'ultima volta, riparte al primo tocco, quale che sia.
 */
export const Ambience = () => {
  const [acceso, setAcceso] = useState(false);
  const motore = useRef<{ ctx: AudioContext; volume: GainNode; timer: number } | null>(null);

  const spegni = useCallback(() => {
    if (!motore.current) return;
    const { ctx, volume, timer } = motore.current;
    motore.current = null;
    window.clearTimeout(timer);
    // Staccare di netto fa un tonfo: prima si chiude il rubinetto, poi si chiude tutto.
    volume.gain.cancelScheduledValues(ctx.currentTime);
    volume.gain.setValueAtTime(Math.max(volume.gain.value, 0.0001), ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 700);
    setAcceso(false);
  }, []);

  const accendi = useCallback(async () => {
    if (motore.current) return;
    const ctx = new AudioContext();
    await ctx.resume();

    const volume = ctx.createGain();
    volume.gain.setValueAtTime(0.0001, ctx.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2.5);
    volume.connect(ctx.destination);

    const { giro } = costruisci(ctx, volume);

    let prossimo = ctx.currentTime + 0.15;
    const programma = () => {
      // Si tiene un giro di vantaggio: se la scheda va in secondo piano e i
      // timer rallentano, quel che suona è già stato deciso.
      while (prossimo < ctx.currentTime + CICLO) {
        giro(prossimo);
        prossimo += CICLO;
      }
      if (motore.current) motore.current.timer = window.setTimeout(programma, (CICLO / 2) * 1000);
    };
    motore.current = { ctx, volume, timer: 0 };
    programma();
    setAcceso(true);
  }, []);

  // Se era acceso l'ultima volta, riparte al primo tocco sulla pagina.
  useEffect(() => {
    if (localStorage.getItem(RICORDO) !== "on") return;
    const riprendi = () => void accendi();
    window.addEventListener("pointerdown", riprendi, { once: true });
    window.addEventListener("keydown", riprendi, { once: true });
    return () => {
      window.removeEventListener("pointerdown", riprendi);
      window.removeEventListener("keydown", riprendi);
    };
  }, [accendi]);

  useEffect(() => () => spegni(), [spegni]);

  const premuto = () => {
    if (acceso) {
      localStorage.setItem(RICORDO, "off");
      spegni();
    } else {
      localStorage.setItem(RICORDO, "on");
      void accendi();
    }
  };

  return (
    <button
      onClick={premuto}
      className="btn btn-ghost btn-sm px-2 text-primary"
      title={acceso ? "silence" : "ambience"}
      aria-label={acceso ? "silence" : "ambience"}
    >
      {acceso ? <Volume2 className="h-5 w-5" strokeWidth={1.5} /> : <VolumeX className="h-5 w-5" strokeWidth={1.5} />}
    </button>
  );
};
