import { combineReducers } from "redux";
import roomReducer from "./room";
const rootReducer = combineReducers({
    room: roomReducer,
});
export default rootReducer;
