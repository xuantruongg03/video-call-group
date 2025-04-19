import axiosClient from "../apis/api-client";

const checkUsername = async (params: { username: string, roomId: string }) => {
    const response = await axiosClient.post(`/sfu/validate-username`, params);
    return response;
};

const roomCheckStatus = async (params: { roomId: string }) => {
    const response = await axiosClient.post(`/sfu/check-room-status`, params);
    return response;
};

const verifyRoom = async (params: { roomId: string, password: string }) => {
    const response = await axiosClient.post(`/sfu/verify-room-password`, params);
    return response;
};

const unlockRoom = async (params: { roomId: string, creatorId: string }) => {
    const response = await axiosClient.post(`/sfu/unlock-room`, params);
    return response;
};

const lockRoom = async (params: { roomId: string, creatorId: string, password: string }) => {
    const response = await axiosClient.post(`/sfu/lock-room`, params);
    return response;
};

const roomService = {
    checkUsername,
    verifyRoom,
    roomCheckStatus,
    unlockRoom,
    lockRoom
}

export default roomService;

