import { createConnection, type Socket } from "node:net";
import { EXTENSION_NAME, MAX_PAYLOAD_PART_LENGTH, SOCKET_TIMEOUT_MS } from "./constants";
import type { MuxyConfig, MuxyEnv, MuxyNotification } from "./types";

export function loadMuxyConfig(env: MuxyEnv): MuxyConfig | undefined {
  const socketPath = env.MUXY_SOCKET_PATH;
  const paneId = env.MUXY_PANE_ID;

  if (!socketPath || !paneId) return undefined;
  return { socketPath, paneId };
}

function sanitizePayloadPart(value: string): string {
  return value.replace(/[\n\r|]+/g, " ").slice(0, MAX_PAYLOAD_PART_LENGTH);
}

function formatMuxyPayload(config: MuxyConfig, notification: MuxyNotification): string {
  return [
    "pi",
    config.paneId,
    sanitizePayloadPart(notification.title),
    sanitizePayloadPart(notification.body),
  ].join("|");
}

function logMuxyError(message: string, error: unknown): void {
  const details = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[${EXTENSION_NAME}] ${message}: ${details}\n`);
}

function waitForSocketClose(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      socket.off("close", handleClose);
    };

    const handleClose = () => {
      cleanup();
      resolve();
    };

    timeout = setTimeout(() => {
      cleanup();
      socket.destroy();
      resolve();
    }, SOCKET_TIMEOUT_MS);

    socket.once("close", handleClose);
  });
}

export async function sendMuxyNotification(
  config: MuxyConfig,
  notification: MuxyNotification,
): Promise<void> {
  try {
    const socket = createConnection({ path: config.socketPath });

    socket.once("error", (error) => {
      logMuxyError("socket error", error);
    });

    socket.write(formatMuxyPayload(config, notification), () => {
      socket.end();
    });

    await waitForSocketClose(socket);
  } catch (error) {
    logMuxyError("connection error", error);
  }
}
