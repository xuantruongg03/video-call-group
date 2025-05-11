import { sfuSocket } from "@/hooks/use-call";
import { ActionLogType } from "@/interfaces/action";
import { TypeUserEvent } from "@/interfaces/behavior";
import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import useDetectEye from "./use-detect-eye";

interface BehaviorMonitorProps {
  roomId: string;
}

export default function useBehaviorMonitor({ roomId }: BehaviorMonitorProps) {
  const dispatch = useDispatch();
  const { isLookingAtScreen, isInitialized, hasCamera } = useDetectEye();
  const interval = useRef<NodeJS.Timeout | null>(null);
  const logSendInterval = useRef<NodeJS.Timeout | null>(null);
  const room = useSelector((state: any) => state.room);
  const log = useSelector((state: any) => state.log);
  const { isMonitorActive, eventLog } = log;
  const { username, isCreator } = room;
  const eventListenersRegistered = useRef(false);
  const requestLogThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestTimeRef = useRef(0);

  const sendLogsToServer = useCallback(async () => {
    if (eventLog && eventLog.length > 0 && username && roomId) {
      try {
        sfuSocket.emit("sfu:send-behavior-logs", {
          peerId: username,
          roomId,
          behaviorLogs: eventLog,
        });
        dispatch({ type: ActionLogType.RESET_EVENT_LOG, payload: [] });
        return true;
      } catch (error) {
        console.error("Failed to send behavior logs:", error);
        return false;
      }
    }
    return true;
  }, [eventLog, username, roomId, dispatch]);

  // Hàm tiết chế (throttle) việc gửi logs để tránh gửi quá nhiều lần
  const throttledSendLogs = useCallback(() => {
    const now = Date.now();
    // Chỉ gửi logs nếu đã qua ít nhất 5 giây kể từ lần cuối
    if (now - lastRequestTimeRef.current > 5000) {
      lastRequestTimeRef.current = now;
      sendLogsToServer();
    } else if (!requestLogThrottleRef.current) {
      // Nếu có nhiều yêu cầu trong thời gian ngắn, lên lịch gửi sau khoảng thời gian hợp lý
      requestLogThrottleRef.current = setTimeout(() => {
        lastRequestTimeRef.current = Date.now();
        sendLogsToServer();
        requestLogThrottleRef.current = null;
      }, 5000 - (now - lastRequestTimeRef.current));
    }
  }, [sendLogsToServer]);

  useEffect(() => {
    // Đảm bảo chỉ đăng ký các sự kiện một lần
    if (eventListenersRegistered.current || !sfuSocket) {
      return;
    }

    if (!sfuSocket) {
      console.warn("Socket not initialized");
      return;
    }

    let mounted = true;
    eventListenersRegistered.current = true;

    const handleBehaviorMonitorState = (data: { isActive: boolean }) => {
      if (!mounted) return;
      dispatch({
        type: ActionLogType.SET_MONITOR_ACTIVE,
        payload: {
          isActive: data.isActive,
        },
      });
      if (isCreator) return;

      if (!data.isActive) {
        throttledSendLogs();
      }
    };

    const handleRequestUserLog = (data: { peerId: string }) => {
      if (isCreator) return;
      if (data.peerId === username) {
        throttledSendLogs();
      }
    };

    // Xóa bất kỳ người nghe sự kiện nào đã đăng ký trước đó
    sfuSocket.off("sfu:behavior-monitor-state");
    sfuSocket.off("sfu:request-user-log");

    // Đăng ký người nghe sự kiện mới
    sfuSocket.on("sfu:behavior-monitor-state", handleBehaviorMonitorState);
    sfuSocket.on("sfu:request-user-log", handleRequestUserLog);

    return () => {
      mounted = false;
      eventListenersRegistered.current = false;

      // Dọn dẹp các tiết chế nếu component unmount
      if (requestLogThrottleRef.current) {
        clearTimeout(requestLogThrottleRef.current);
        requestLogThrottleRef.current = null;
      }

      // Hủy đăng ký người nghe sự kiện
      sfuSocket.off("sfu:behavior-monitor-state", handleBehaviorMonitorState);
      sfuSocket.off("sfu:request-user-log", handleRequestUserLog);
    };
  }, [isCreator, username, roomId, dispatch, throttledSendLogs]);

  const toggleBehaviorMonitoring = useCallback(() => {
    if (!isCreator) return;
    if (sfuSocket && sfuSocket.connected) {
      try {
        if (isMonitorActive) {
          toast.info("Tắt giám sát, đang tải logs...");
          sfuSocket.emit(
            "sfu:download-room-log",
            {
              roomId,
              peerId: username,
            },
            (file: any) => {
              if (file && file.success) {
                window.URL.revokeObjectURL(file.file);
                const blob = new Blob([file.file], {
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `behavior-logs-${roomId}-${new Date()
                  .toISOString()
                  .slice(0, 10)}.xlsx`;
                document.body.appendChild(a);
                a.click();

                setTimeout(() => {
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                }, 100);

                toast.success("Đã tải xuống file log thành công");
              } else if (file && !file.success) {
                toast.error(file.error || "Không thể tải xuống file log");
              }
            }
          );
        } else {
          toast.info("Bắt đầu giám sát...");
        }

        sfuSocket.emit("sfu:toggle-behavior-monitor", {
          roomId,
          peerId: username,
          isActive: !isMonitorActive,
        });
      } catch (err) {
        console.error("Error sending toggle monitoring command:", err);
        toast.error("Lỗi khi thay đổi trạng thái giám sát");
      }
    } else {
      console.warn("Socket not connected, can't toggle monitoring");
      toast.error("Không thể kết nối đến server");
    }
  }, [isCreator, roomId, username, isMonitorActive]);

  useEffect(() => {
    if (isMonitorActive && !isCreator) {
      logSendInterval.current = setInterval(() => {
        if (eventLog.length > 0) {
          sendLogsToServer();
        }
      }, 30000);

      return () => {
        if (logSendInterval.current) {
          clearInterval(logSendInterval.current);
          logSendInterval.current = null;
        }
      };
    } else if (!isMonitorActive && logSendInterval.current) {
      // Clear interval when monitoring is deactivated
      clearInterval(logSendInterval.current);
      logSendInterval.current = null;
    }
  }, [isMonitorActive, eventLog.length, isCreator, sendLogsToServer]);

  useEffect(() => {
    if (!isMonitorActive) {
      return;
    }

    // --- Giám sát người dùng chuyển tab ---
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === "visible";
      dispatch({
        type: ActionLogType.SET_EVENT_LOG,
        payload: [
          {
            type: TypeUserEvent.FOCUS_TAB,
            value: isVisible,
            time: new Date(),
          },
        ],
      });
    };

    // --- Giám sát người dùng chuyển cửa sổ ---
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        // Tránh ghi đè nếu tab đang ẩn
        dispatch({
          type: ActionLogType.SET_EVENT_LOG,
          payload: [
            {
              type: TypeUserEvent.FOCUS,
              value: true,
              time: new Date(),
            },
          ],
        });
      }
    };

    const handleBlur = () => {
      if (document.visibilityState === "visible") {
        // Chỉ ghi blur nếu tab đang active => tức là mất focus do chuyển cửa sổ
        dispatch({
          type: ActionLogType.SET_EVENT_LOG,
          payload: [
            {
              type: TypeUserEvent.FOCUS,
              value: false,
              time: new Date(),
            },
          ],
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    let eyeTrackingInterval = 10000;

    // Giám sát người dùng có đang nhìn vào màn hình hay không
    if (isInitialized && hasCamera) {
      const handleEye = () => {
        console.log("isLookingAtScreen", isLookingAtScreen);
        if (isLookingAtScreen) {
          // dispatch({
          //   type: ActionLogType.SET_EVENT_LOG,
          //   payload: [
          //     { type: TypeUserEvent.ATTENTION, value: true, time: new Date() },
          //   ],
          // });
        } else {
          dispatch({
            type: ActionLogType.SET_EVENT_LOG,
            payload: [
              { type: TypeUserEvent.ATTENTION, value: false, time: new Date() },
            ],
          });
        }
      };

      interval.current = setInterval(handleEye, eyeTrackingInterval);
    }

    return () => {
      if (interval.current) {
        clearInterval(interval.current);
        interval.current = null;
      }

      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isMonitorActive, isInitialized, hasCamera, dispatch]);

  return {
    isMonitorActive,
    toggleBehaviorMonitoring,
    sendLogsToServer,
  };
}
