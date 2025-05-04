import { sfuSocket } from "@/hooks/use-call";
import useUser from "@/hooks/use-user";
import { Excalidraw, TTDDialog } from "@excalidraw/excalidraw";
import type {
  NonDeletedExcalidrawElement
} from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  Gesture
} from "@excalidraw/excalidraw/types";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import React, { Children, cloneElement, useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "./ui/sheet";
import "@excalidraw/excalidraw/index.css";
import { throttle } from 'lodash';
import { useWhiteboardSync } from "@/hooks/use-whiteboard";
import { WhiteboardPermissionsDialog } from "./Dialogs/WhiteboardPermissionsDialog";

type PositionMouse = {
  x: number;
  y: number;
  tool: string;
};

type RemotePointer = {
  position: PositionMouse;
  peerId: string;
};

interface WhiteboardProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Whiteboard = ({ roomId, isOpen, onClose }: WhiteboardProps) => {
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [allowedUsers, setAllowedUsers] = useState<string[]>([]);

  const excalidrawRef = useRef<ExcalidrawImperativeAPI>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [sheetFullyOpen, setSheetFullyOpen] = useState(false);
  const [remotePointers, setRemotePointers] = useState<Record<string, RemotePointer>>({});

  const pointerDataRef = useRef<any>(null);
  const lastToolRef = useRef<string | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const isCreatorRef = useRef<boolean>(false);
  const canDrawRef = useRef<boolean>(false);
  
  const throttledEmitPointer = useRef(
    throttle((roomId: string, position: PositionMouse) => {
      sfuSocket.emit('whiteboard:pointer', { roomId, position });
    }, 50)
  ).current;

  const { handlePointerUpdate, handleChange } = useWhiteboardSync({
    isOpen,
    roomId,
    sfuSocket,
    excalidrawAPI,
  });

  const handleChangeRef = useRef(handleChange);
  useEffect(() => {
    handleChangeRef.current = handleChange;
  }, [handleChange]);

  const handlePointerUpdateRef = useRef(handlePointerUpdate);
  useEffect(() => {
    handlePointerUpdateRef.current = handlePointerUpdate;
  }, [handlePointerUpdate]);

  useEffect(() => {
    if (excalidrawAPI) {
      excalidrawRef.current = excalidrawAPI;
      
      const scene = excalidrawAPI.getSceneElements();
      console.log("Initial scene elements:", scene.length);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI) return;

    const syncAfterUserAction = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
      
      const elements = excalidrawAPI.getSceneElements();
      const state = excalidrawAPI.getAppState();
      
      if (elements.length > 0) {
        console.log("Syncing after user action, elements:", elements.length);
        handleChangeRef.current([...elements], state);
      }
    };

    const container = document.querySelector('.excalidraw-container');
    if (container) {
      container.addEventListener('mouseup', syncAfterUserAction);
      container.addEventListener('touchend', syncAfterUserAction);
      
      return () => {
        container.removeEventListener('mouseup', syncAfterUserAction);
        container.removeEventListener('touchend', syncAfterUserAction);
      };
    }
  }, [excalidrawAPI]);

  const { users } = useUser(roomId);
  const room = useSelector((state: any) => state.room);
  const myName = room.username;

  useEffect(() => {
    const myData = users?.find(user => user.peerId === myName);
    if (myData?.isCreator) {
      isCreatorRef.current = true;
      canDrawRef.current = true;
    }
  }, [users, myName]);

  useEffect(() => {
    if (!sfuSocket.connected) {
      sfuSocket.connect();
    }

    const onWhiteboardPermissions = (data: { allowed: string[] }) => {
      setAllowedUsers(data.allowed);
      if (data.allowed.includes(myName) && !isCreatorRef.current) {
        canDrawRef.current = true;
      }
    };

    sfuSocket.on('whiteboard:permissions', onWhiteboardPermissions);

    return () => {
      sfuSocket.off('whiteboard:permissions');
    };
  }, [roomId, myName]);

  const handleUpdatePermissions = (allowedUsers: string[]) => {
    setAllowedUsers(allowedUsers);
    sfuSocket.emit('whiteboard:update-permissions', { roomId, allowed: allowedUsers });
    setIsPermissionsDialogOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setSheetFullyOpen(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSheetFullyOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!excalidrawAPI) return;

    const handleRemotePointers = (data: any) => {
      if (!data || !data.pointers) {
        console.warn("Invalid pointers data format:", data);
        return;
      }

      try {
        if (Array.isArray(data.pointers)) {
          const collaborators = new Map();
          
          data.pointers.forEach((pointer: any) => {
            if (pointer.peerId === myName) return;
            
            const user = users?.find(u => u.peerId === pointer.peerId);
          
            collaborators.set(pointer.peerId, {
              username: user?.peerId,
              pointer: pointer.position,
              selectedElementIds: {},
              button: "up",
              color: getColorFromPeerId(pointer.peerId)
            });
          });
          
          excalidrawAPI.updateScene({
            collaborators
          });
        }
      } catch (error) {
        console.error("Error processing pointers data:", error);
      }
    };

    sfuSocket.on('whiteboard:pointers', handleRemotePointers);

    return () => {
      sfuSocket.off('whiteboard:pointers');
    };
  }, [excalidrawAPI, users, myName]);

  useEffect(() => {
    if (!excalidrawAPI) return;

    const checkToolChange = () => {
      const currentTool = excalidrawAPI.getAppState().activeTool.type;

      if (currentTool !== lastToolRef.current) {
        lastToolRef.current = currentTool;

        if (pointerDataRef.current?.pointer) {
          const position: PositionMouse = {
            x: pointerDataRef.current.pointer.x,
            y: pointerDataRef.current.pointer.y,
            tool: currentTool
          };

          sfuSocket.emit('whiteboard:pointer', { roomId, position });
        }
      }
    };

    const toolChangeInterval = setInterval(checkToolChange, 100);

    return () => {
      clearInterval(toolChangeInterval);
    };
  }, [excalidrawAPI, roomId]);

  const handlePointerDown = (payload: any, event: any) => {
    isDraggingRef.current = true;
  };

  const handlePointerUp = (payload: any, event: any) => {
    isDraggingRef.current = false;
    if (pointerDataRef.current?.pointer) {
      const elements = excalidrawAPI?.getSceneElements() || [];
      const state = excalidrawAPI?.getAppState();
      
      if (elements.length > 0 && state) {
        console.log("Syncing on pointer up, elements:", elements.length);
        handleChangeRef.current([...elements], state);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (isOpen) {
        sfuSocket.emit('whiteboard:pointer-leave', { roomId });
      }

      throttledEmitPointer.cancel();
    };
  }, [roomId, isOpen, throttledEmitPointer]);

  const getColorFromPeerId = (peerId: string) => {
    let hash = 0;
    for (let i = 0; i < peerId.length; i++) {
      hash = peerId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const h = Math.abs(hash) % 360;
    return `hsl(${h}, 80%, 60%)`;
  };

  // Nhận dữ liệu đầy đủ khi mở whiteboard
  useEffect(() => {
    if (!isOpen || !excalidrawAPI) return;
    sfuSocket.emit('whiteboard:get-data', { roomId });
    const handleFullWhiteboardData = (data: any) => {
      if (!data.whiteboard || !excalidrawAPI) return;
      
      try {
        const { elements, state, version } = data.whiteboard;

        if (elements && Array.isArray(elements)) {
          if (elements.length === 0) {
            excalidrawAPI.resetScene();
            return;
          }
          
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
        } else {
          console.warn("Invalid elements data received:", elements);
        }
      } catch (err) {
        console.error("Error setting initial whiteboard data:", err);
      }
    };

    sfuSocket.on('whiteboard:data', handleFullWhiteboardData);

    return () => {
      sfuSocket.off('whiteboard:data', handleFullWhiteboardData);
    };
  }, [isOpen, roomId, excalidrawAPI]);

  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={onClose}
        
      >
        <SheetContent
          className="sm:max-w-[800px] md:max-w-[1000px] w-full p-0"
          side="right"

          style={{ transition: "none" }}>
          <SheetHeader className="p-4 border-b">
            <div className="flex justify-between items-center">
              <SheetTitle>Bảng trắng</SheetTitle>
              <div className="flex items-center gap-2">
                {isCreatorRef.current && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPermissionsDialogOpen(true)}
                  >
                    <Lock className="h-4 w-4 mr-1" />
                    Quản lý quyền vẽ
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <SheetDescription>
              {!canDrawRef.current && !isCreatorRef.current && (
                <div className="text-yellow-600 bg-yellow-50 p-2 rounded-md mt-2">
                  <span>Bạn chỉ có thể xem bảng trắng này. Chỉ chủ phòng mới có thể vẽ hoặc cấp quyền vẽ.</span>
                </div>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="excalidraw-container" 
            style={{
              height: "calc(100vh - 120px)",
              width: "100%",
              position: "relative",
              overflow: "hidden"
            }}>
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              touchAction: "none"
            }}>
              {sheetFullyOpen && (
                <>
                  <Excalidraw
                    onChange={(elements, state) => {
                      if (isDraggingRef.current) {
                        if (elements.length > 0) {
                          handleChangeRef.current([...elements], state);
                        }
                      }
                    }}
                    excalidrawAPI={(api) => {
                      console.log("Excalidraw API initialized");
                      setExcalidrawAPI(api);
                    }}
                    initialData={{
                      appState: {
                        viewBackgroundColor: "#ffffff",
                        currentItemStrokeColor: "#000000",
                        collaborators: new Map(),
                        // scrollX: 0,
                        // scrollY: 0
                      },
                      scrollToContent: true
                    }}
                    onPointerUpdate={(payload) => {
                      handlePointerUpdateRef.current(payload);
                    }}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    viewModeEnabled={!canDrawRef.current && !isCreatorRef.current}
                    zenModeEnabled={false}
                    gridModeEnabled={false}
                    theme="light"
                    name="Whiteboard Session"
                    UIOptions={{
                      canvasActions: {
                        loadScene: false,
                        saveToActiveFile: true,
                        export: false,
                        clearCanvas: canDrawRef.current || isCreatorRef.current,
                        changeViewBackgroundColor: true
                      },
                      tools: { image: false },
                    }}
                  />
                </>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {isPermissionsDialogOpen && (
        <WhiteboardPermissionsDialog
          isOpen={isPermissionsDialogOpen}
          onClose={() => setIsPermissionsDialogOpen(false)}
          users={users || []}
          allowedUsers={allowedUsers}
          onUpdatePermissions={handleUpdatePermissions}
        />
      )}
    </>
  );
};