import { useState } from "react";
import { Behavior } from "@/interfaces/behavior";

function useBehaviorMonitor() {
    const [behavior, setBehavior] = useState<Behavior[]>([]);

    
    return { behavior, setBehavior };
}

export default useBehaviorMonitor;
