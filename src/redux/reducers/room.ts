import { ActionRoom } from "../../interfaces/action";

const initialState = {
  username: "",
  password: "",
  isLocked: false,
};

const roomReducer = (state = initialState, action: ActionRoom) => {
  switch (action.type) {
    case "JOIN_ROOM":    
      state = {
        ...state,
        username: action.payload?.username || state.username,
        password: action.payload?.password || state.password,
        isLocked: action.payload?.isLocked || state.isLocked,
      };
      return state;
    case "LEAVE_ROOM":
      state = {
        ...state,
        username: "",
        password: "",
        isLocked: false,
      };
      return state;
    default:
      return state;
  }
};

export default roomReducer;
