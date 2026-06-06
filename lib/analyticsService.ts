import { addDoc, collection } from "firebase/firestore";
import { db } from "./firebase";
import { getPlayerId } from "./playerIdentity";

type EventName =
  | "game_started"
  | "doll_placed"
  | "doll_detected"
  | "capture_attempted"
  | "capture_too_far"
  | "capture_success"
  | "game_finished";

export async function logEvent(
  code: string,
  event: EventName,
  data?: Record<string, any>,
) {
  try {
    const playerId = await getPlayerId();
    await addDoc(collection(db, "games", code, "events"), {
      event,
      playerId,
      timestamp: Date.now(),
      ...data,
    });
  } catch (e) {
    // Logs são opcionais — nunca bloquear o jogo
    console.warn("Analytics error:", e);
  }
}
