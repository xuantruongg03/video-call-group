export interface ActionRoom {
  type: string;
  payload?: {
    username?: string;
    password?: string;
    isLocked?: boolean;
  };
}

