import { combineReducers } from "redux";
import roomReducer from "./room";
import videoReducer from "./video";
import logReducer from "./log";

const rootReducer = combineReducers({
    room: roomReducer,
    video: videoReducer,
    log: logReducer,
});

export default rootReducer;
