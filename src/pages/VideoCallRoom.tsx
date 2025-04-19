
import { useParams } from "react-router-dom";
import { VideoCall } from "@/components/VideoCall";

const VideoCallRoom = () => {
  const { roomId } = useParams();

  return (
    <div className="h-screen">
      <VideoCall roomId={roomId} />
    </div>
  );
};

export default VideoCallRoom;
