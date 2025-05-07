import { useEffect, useRef, useCallback } from "react";
import { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { Socket } from "socket.io-client";
import { toast } from "sonner";

type PointerData = {
  pointer: { x: number; y: number; tool: string };
  button: number;
  pointersMap: any;
};

type Props = {
  isOpen: boolean;
  roomId: string;
  sfuSocket: Socket;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
};

export const useWhiteboardSync = ({
  isOpen,
  roomId,
  sfuSocket,
  excalidrawAPI,
}: Props) => {
  const pointerDataRef = useRef<PointerData | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const pendingUpdateRef = useRef<{elements: any[], state: any} | null>(null);
  const lastVersionRef = useRef<number>(0);
  const DEBOUNCE_INTERVAL = 200; // ms - Tăng lên để giảm số lượng cập nhật
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Khởi tạo socket event listeners
  useEffect(() => {
    if (!sfuSocket.connected) {
      sfuSocket.connect();
    }
    
    // Đăng ký nhận cập nhật whiteboard từ server
    const handleUpdate = (data: any) => {
      if (!excalidrawAPI || !data.elements) return;
      
      console.log("Received whiteboard update from server, version:", data.version);
      
      // Cập nhật phiên bản mới nhất
      if (data.version) {
        lastVersionRef.current = Math.max(lastVersionRef.current, data.version);
      }
      
      try {
        const appState = {
          ...excalidrawAPI.getAppState(),
          ...(data.state || {}),
          // Bảo toàn viewModeEnabled dựa trên quyền local
          viewModeEnabled: excalidrawAPI.getAppState().viewModeEnabled,
          collaborators: new Map()
        };
        
        excalidrawAPI.updateScene({
          elements: data.elements,
          appState
        });
        console.log("Applied whiteboard update, elements:", data.elements.length);
      } catch (err) {
        console.error("Error applying whiteboard update:", err);
      }
    };

    sfuSocket.on("whiteboard:updated", handleUpdate);
    
    return () => {
      sfuSocket.off("whiteboard:updated", handleUpdate);
      
      // Hủy timeout nếu có
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [sfuSocket, excalidrawAPI]);

  // Gửi dữ liệu khi di chuyển chuột
  const handlePointerUpdate = useCallback((payload: any) => {
    if (!excalidrawAPI) return;

    const currentTool = excalidrawAPI.getAppState().activeTool.type || "selection";
    const position = {
      x: payload.pointer.x,
      y: payload.pointer.y,
      tool: currentTool,
    };

    pointerDataRef.current = {
      pointer: position,
      button: payload.button,
      pointersMap: payload.pointersMap,
    };

    sfuSocket.emit("whiteboard:pointer", { roomId, position });
  }, [excalidrawAPI, roomId, sfuSocket]);

  // Gửi cập nhật đã lên lịch
  const sendPendingUpdate = useCallback(() => {
    if (!pendingUpdateRef.current) return;
    
    const { elements, state } = pendingUpdateRef.current;
    
    // Tăng phiên bản mỗi khi gửi cập nhật
    lastVersionRef.current++;
    const version = lastVersionRef.current;
    
    sfuSocket.emit("whiteboard:update", {
      roomId,
      elements,
      state: state ? {
        viewBackgroundColor: state.viewBackgroundColor,
        currentItemStrokeColor: state.currentItemStrokeColor,
        currentItemBackgroundColor: state.currentItemBackgroundColor,
        currentItemFillStyle: state.currentItemFillStyle,
        currentItemStrokeWidth: state.currentItemStrokeWidth,
        currentItemRoughness: state.currentItemRoughness,
        currentItemOpacity: state.currentItemOpacity,
        currentItemFontFamily: state.currentItemFontFamily,
        currentItemFontSize: state.currentItemFontSize,
        currentItemTextAlign: state.currentItemTextAlign,
        currentItemStrokeStyle: state.currentItemStrokeStyle,
      } : {},
      version,
      timestamp: Date.now()
    });
    
    // Xóa cập nhật đang chờ
    pendingUpdateRef.current = null;
    updateTimeoutRef.current = null;
  }, [roomId, sfuSocket]);

  const handleChange = useCallback((elements: any[], state: any) => {
    if (!elements || !Array.isArray(elements)) return;
    
    pendingUpdateRef.current = { elements: [...elements], state };
    
    const now = Date.now();
    if (now - lastUpdateRef.current < DEBOUNCE_INTERVAL) {
      if (updateTimeoutRef.current) return;
      
      updateTimeoutRef.current = setTimeout(() => {
        sendPendingUpdate();
      }, DEBOUNCE_INTERVAL);
      return;
    }
    
    lastUpdateRef.current = now;
    sendPendingUpdate();
  }, [DEBOUNCE_INTERVAL, sendPendingUpdate]);

  useEffect(() => {
    if (isOpen && excalidrawAPI) {
      sfuSocket.emit("whiteboard:get-data", { roomId });
    }
  }, [isOpen, roomId, sfuSocket, excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI) return;
    
    const handleWhiteboardData = (data: any) => {
      if (!data.whiteboard || !excalidrawAPI) return;
      
      const { elements, state, version } = data.whiteboard;
      
      if (version) {
        lastVersionRef.current = version;
      }

      if (elements && Array.isArray(elements)) {
        try {
          const appState = {
            ...excalidrawAPI.getAppState(),
            ...(state || {}),
            viewModeEnabled: excalidrawAPI.getAppState().viewModeEnabled,
            collaborators: new Map()
          };
          
          excalidrawAPI.updateScene({
            elements,
            appState
          });
          console.log("Initial scene updated successfully");
        } catch (err) {
          console.error("Error updating initial scene:", err);
        }
      }
    };

    sfuSocket.on("whiteboard:data", handleWhiteboardData);

    return () => {
      sfuSocket.off("whiteboard:data", handleWhiteboardData);
    };
  }, [sfuSocket, excalidrawAPI]);

  useEffect(() => {
    if (isOpen) {
      sfuSocket.on("whiteboard:error", (data: any) => {
        toast.error(data.message);
      });
    }
  }, [isOpen, roomId, sfuSocket]);

  return {
    handlePointerUpdate,
    handleChange,
  };
};
