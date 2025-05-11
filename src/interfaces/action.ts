import { UserEvent } from "./behavior";

export interface ActionRoom {
  type: string;
  payload?: {
    username?: string;
    password?: string;
    isLocked?: boolean;
    isCreator?: boolean;
  };
}
export enum ActionVideoType {
  SET_LOCAL_VIDEO_REF = "SET_LOCAL_VIDEO_REF",
  CLEAR_LOCAL_VIDEO_REF = "CLEAR_LOCAL_VIDEO_REF",
}

export interface ActionVideo {
  type: ActionVideoType;
  payload?: {
    localVideoRef: HTMLVideoElement | null;
  };
}

export enum ActionLogType {
  SET_EVENT_LOG = "SET_EVENT_LOG",
  RESET_EVENT_LOG = "RESET_EVENT_LOG",
  SET_MONITOR_ACTIVE = "SET_MONITOR_ACTIVE",
}

export interface ActionLog {
  type: ActionLogType;
  payload: UserEvent[] | { isActive?: boolean };
}

