export enum TypeUserEvent {
  MIC = "mic",
  CAM = "cam",
  FOCUS_TAB = "focus_tab",
  ATTENTION = "attention",
  FOCUS = "focus",
  EYE_CLOSED = "eye_closed",
  EYE_OPEN = "eye_open",
}

export interface UserEvent {
  type: TypeUserEvent;
  value: boolean;
  time: Date;
}

// export interface ParticipantState {
//   userId: string;
//   micOn: boolean;
//   camOn: boolean;
//   lastMicToggle?: number;
//   lastCamToggle?: number;
//   isFocused: boolean;
//   isPayingAttention: boolean;
//   lastFocusChange?: number;
//   attentionDurations: number[];
//   chatCount: number;
//   interactionCount: number;
//   joinedAt: number;
//   totalActiveTime: number;
//   audioBitrate?: number;
//   videoFPS?: number;
//   connectionQuality?: string;
// }