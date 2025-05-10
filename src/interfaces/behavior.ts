export interface Behavior {
    type: "speaking" | "typing" | "camera" | "microphone";
    timestamp: number;
}