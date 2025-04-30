import CONSTANT from "@/lib/constant";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { sfuSocket } from "./use-call";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

interface User {
    peerId: string,
    isCreator: boolean,
    timeArrive: Date
}

function useUser(roomId: string) {

    const [users, setUsers] = useState<User[] | null>(null);
    const room = useSelector((state: any) => state.room);
    const navigator = useNavigate();
    useEffect(() => {
        if(!sfuSocket.connected) {
            sfuSocket.connect();
        }

        const onReceiveUsers = (users: User[]) => {
            setUsers(users);
        }

        const onUserRemoved = ({peerId}: {peerId: string}) => {            
            // const myName = localStorage.getItem(CONSTANT.USER_NAME);
            const myName = room.username;
            if (peerId === myName) {
                toast.success(`Bạn đã bị xoá khỏi phòng`);
                sfuSocket.emit("sfu:leave-room", { roomId });
                // window.location.href = "/";
                navigator("/");
            } else {
                toast.success(`${peerId} đã bị xoá khỏi phòng`);
                setUsers(prevUsers => prevUsers?.filter(user => user.peerId !== peerId));
            }
             
        }

        const onUserJoined = (data: User) => {
            setUsers(prevUsers => [...prevUsers, data]);
        }

        if (sfuSocket.connected) {
            sfuSocket.emit("sfu:get-users", { roomId });
          }

        sfuSocket.on("sfu:user-removed", onUserRemoved);

        sfuSocket.on("sfu:users", onReceiveUsers);

        sfuSocket.on("sfu:new-peer-join", onUserJoined);

        return () => {
            sfuSocket.off("sfu:users");
            sfuSocket.off("sfu:user-removed");
            sfuSocket.off("sfu:get-users");
            sfuSocket.off("sfu:new-peer-join");
        };
    }, [
        sfuSocket.connected,
        roomId
    ]);

    const handleRemoveUser = (participantId: string) => {
        sfuSocket.emit("sfu:remove-user", {roomId, participantId});
    }

    return { users, handleRemoveUser };
}

export default useUser;
