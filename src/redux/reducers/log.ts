import { ActionLog, ActionLogType } from "@/interfaces/action";
import { UserEvent } from "@/interfaces/behavior";

const initialState = {
  eventLog: [] as UserEvent[],
  isMonitorActive: false,
};

const logReducer = (state = initialState, action: ActionLog) => {
  switch (action.type) {
    case ActionLogType.SET_EVENT_LOG:
      if (!Array.isArray(action.payload)) {
        return state;
      }
      const newEventLog = [...state.eventLog, ...action.payload];
      return { ...state, eventLog: newEventLog };

    case ActionLogType.RESET_EVENT_LOG:
      return { ...state, eventLog: [] };

    case ActionLogType.SET_MONITOR_ACTIVE:
      if (Array.isArray(action.payload)) {
        return state;
      }
      return {
        ...state,
        isMonitorActive: action.payload.isActive,
      };
    default:
      return state;
  }
};

export default logReducer;
