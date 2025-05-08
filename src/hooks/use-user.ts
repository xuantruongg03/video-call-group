import CONSTANT from "@/lib/constant";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { sfuSocket } from "./use-call";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";

interface User {
    peerId: string,
    isCreator: boolean,
    timeArrive: Date
}

function useUser(roomId: string) {
    // Basic states
    const [users, setUsers] = useState<User[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Redux and routing
    const room = useSelector((state: any) => state.room);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    
    // Handler to remove user - memoized with useCallback
    const handleRemoveUser = useCallback((participantId: string) => {
        if (!roomId) return;
        
        try {
            if (sfuSocket.connected) {
                sfuSocket.emit("sfu:remove-user", {roomId, participantId});
            } else {
                toast.error("Mất kết nối đến máy chủ");
            }
        } catch (err) {
            console.error("Error removing user:", err);
            setError("Lỗi khi xóa người dùng");
        }
    }, [roomId]);
    
    // Main socket event handling
    useEffect(() => {
        if (!roomId) return; // Không xử lý nếu không có roomId
        
        // Handler functions
        const onReceiveUsers = (users: User[]) => {
            try {
                setUsers(users);
                
                // Kiểm tra trạng thái creator của người dùng hiện tại
                const myData = users?.find(user => user.peerId === room.username);
                if (myData?.isCreator) {
                    dispatch({ type: "SET_CREATOR", payload: { isCreator: true } });
                } else {
                    dispatch({ type: "SET_CREATOR", payload: { isCreator: false } });
                }
            } catch (err) {
                console.error("Error in onReceiveUsers:", err);
            }
        };

        const onUserRemoved = ({peerId}: {peerId: string}) => {            
            try {
                const myName = room.username;
                if (peerId === myName) {
                    toast.success(`Bạn đã bị xoá khỏi phòng`);
                    sfuSocket.emit("sfu:leave-room", { roomId });
                    navigate("/");
                } else {
                    toast.success(`${peerId} đã bị xoá khỏi phòng`);
                    setUsers(prevUsers => {
                        if (!prevUsers) return null;
                        return prevUsers.filter(user => user.peerId !== peerId);
                    });
                }
            } catch (err) {
                console.error("Error in onUserRemoved:", err);
            }
        };

        const onUserJoined = (data: User) => {
            try {
                setUsers(prevUsers => {
                    if (!prevUsers) return [data];
                    return [...prevUsers, data];
                });
            } catch (err) {
                console.error("Error in onUserJoined:", err);
            }
        };

        const onCreatorChanged = (data: { peerId: string, isCreator: boolean }) => {
            try {
                const myName = room.username;
                
                // Update users list
                setUsers(prevUsers => {
                    if (!prevUsers) return null;
                    
                    return prevUsers.map(user => {
                        // Reset all creators first
                        const updatedUser = {...user, isCreator: false};
                        
                        // Set new creator
                        if (updatedUser.peerId === data.peerId) {
                            updatedUser.isCreator = true;
                        }
                        
                        return updatedUser;
                    });
                });
                console.log(data.peerId, myName);
                
                // Update Redux state
                if (data.peerId === myName) {
                    if(!room.isCreator) {
                        dispatch({ type: "SET_CREATOR", payload: { isCreator: true } });
                        toast.success("Bạn đã trở thành chủ phòng");
                    }
                    // Reset whiteboard permissions
                    sfuSocket.emit('whiteboard:update-permissions', { roomId, allowed: [] });
                } else {
                    dispatch({ type: "SET_CREATOR", payload: { isCreator: false } });
                    toast.info(`${data.peerId} đã trở thành chủ phòng`);
                }
            } catch (err) {
                console.error("Error in onCreatorChanged:", err);
            }
        };

        const onPeerLeft = (data: { peerId: string }) => {
            try {
                setUsers(prevUsers => {
                    if (!prevUsers) return null;
                    return prevUsers.filter(user => user.peerId !== data.peerId);
                });
            } catch (err) {
                console.error("Error in onPeerLeft:", err);
            }
        };

        if (!sfuSocket.connected) {
            try {
                sfuSocket.connect();
            } catch (err) {
                console.error("Error connecting socket:", err);
                setError("Lỗi kết nối socket");
            }
        }
        
        try {
            // Setup event listeners
            sfuSocket.on("sfu:users", onReceiveUsers);
            sfuSocket.on("sfu:user-removed", onUserRemoved);
            sfuSocket.on("sfu:new-peer-join", onUserJoined);
            sfuSocket.on("sfu:creator-changed", onCreatorChanged);
            sfuSocket.on("sfu:peer-left", onPeerLeft);
            
            // Request users list
            sfuSocket.emit("sfu:get-users", { roomId });
        } catch (err) {
            console.error("Error setting up socket events:", err);
            setError("Lỗi thiết lập sự kiện socket");
        }
        
        // Cleanup
        return () => {
            try {
                sfuSocket.off("sfu:users", onReceiveUsers);
                sfuSocket.off("sfu:user-removed", onUserRemoved);
                sfuSocket.off("sfu:new-peer-join", onUserJoined);
                sfuSocket.off("sfu:creator-changed", onCreatorChanged);
                sfuSocket.off("sfu:peer-left", onPeerLeft);
            } catch (err) {
                console.error("Error cleaning up socket events:", err);
            }
        };
    }, [roomId, room.username, navigate, dispatch]);

    return { 
        users, 
        handleRemoveUser,
        error
    };
}

export default useUser;
