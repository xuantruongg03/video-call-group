import { ActionVideo } from "../../interfaces/action";

const initialState = {
  localVideoRef: null as HTMLVideoElement | null,
};

const videoReducer = (state = initialState, action: ActionVideo) => {
  switch (action.type) {
    case "SET_LOCAL_VIDEO_REF":
      return {
        ...state,
        localVideoRef: action.payload?.localVideoRef || null,
      };
    case "CLEAR_LOCAL_VIDEO_REF":
      return {
        ...state,
        localVideoRef: null,
      };
    default:
      return state;
  }
};

export default videoReducer; 