export interface MuxyEnv {
  MUXY_SOCKET_PATH?: string;
  MUXY_PANE_ID?: string;
}

export interface MuxyConfig {
  socketPath: string;
  paneId: string;
}

export interface MuxyNotification {
  title: string;
  body: string;
}

export interface UserAttentionEvent {
  kind: string;
  title?: string;
  body: string;
}

export interface AgentEndEvent {
  messages?: unknown;
}

export interface AssistantMessage {
  role?: unknown;
  content?: unknown;
}

export interface TextContentPart {
  type?: unknown;
  text?: unknown;
}
