import { ActionRoom, ActionRoomType } from "../../interfaces/action";

const initialState = {
  username: "",
  password: "",
  isLocked: false,
  isCreator: false,
  pinnedUsers: [],
};

const roomReducer = (state = initialState, action: ActionRoom) => {
  switch (action.type) {
    case ActionRoomType.JOIN_ROOM:
      state = {
        ...state,
        username: action.payload?.username || state.username,
        password: action.payload?.password || state.password,
        isLocked:
          action.payload?.isLocked !== undefined
            ? action.payload?.isLocked
            : state.isLocked,
        isCreator:
          action.payload?.isCreator !== undefined
            ? action.payload?.isCreator
            : state.isCreator,
      };
      return state;
    case ActionRoomType.LEAVE_ROOM:
      state = {
        ...state,
        username: "",
        password: "",
        isLocked: false,
        isCreator: false,
      };
      return state;
    case ActionRoomType.SET_CREATOR:
      state = {
        ...state,
        isCreator:
          action.payload?.isCreator !== undefined
            ? action.payload.isCreator
            : state.isCreator,
      };
      return state;
    case ActionRoomType.SET_PINNED_USERS:
      const newPinnedUsers = [...state.pinnedUsers, action.payload?.pinnedUsers];
      return {
        ...state,
        pinnedUsers: newPinnedUsers,
      };

    case ActionRoomType.REMOVE_PINNED_USER:
      return {
        ...state,
        pinnedUsers: state.pinnedUsers.filter(
          (user: any) => user.userId !== action.payload
        ),
      };

    case ActionRoomType.RESET_PINNED_USER:
      return {
        ...state,
        pinnedUsers: [],
      };

    case ActionRoomType.RESET:
      return initialState;
    default:
      return state;
  }
};

export default roomReducer;
