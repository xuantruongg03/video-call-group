import { ActionRoom } from "../../interfaces/action";

const initialState = {
  username: "",
  password: "",
  isLocked: false,
  isCreator: false,
};

const roomReducer = (state = initialState, action: ActionRoom) => {
  switch (action.type) {
    case "JOIN_ROOM":
      state = {
        ...state,
        username: action.payload?.username || state.username,
        password: action.payload?.password || state.password,
        isLocked: action.payload?.isLocked !== undefined ? action.payload?.isLocked : state.isLocked,
        isCreator: action.payload?.isCreator !== undefined ? action.payload?.isCreator : state.isCreator,
      };
      return state;
    case "LEAVE_ROOM":
      state = {
        ...state,
        username: "",
        password: "",
        isLocked: false,
        isCreator: false,
      };
      return state;
    case "SET_CREATOR":
      state = {
        ...state,
        isCreator: action.payload?.isCreator !== undefined ? action.payload.isCreator : state.isCreator,
      };
      return state;
    default:
      return state;
  }
};

export default roomReducer;
