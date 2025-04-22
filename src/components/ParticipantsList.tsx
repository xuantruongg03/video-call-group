import { Users, UserX } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Participant {
  id: number;
  name: string;
}

interface ParticipantsListProps {
  participants: Participant[];
}

export const ParticipantsList = ({ participants }: ParticipantsListProps) => {
  const handleRemoveParticipant = (participantId: number, name: string) => {
    toast.success(`Removed ${name} from the room`);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Users className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
            {participants.length}
          </span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Participants ({participants.length})</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary"
            >
              <span className="text-sm">{participant.name}</span>
              {participant.name !== "You" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleRemoveParticipant(participant.id, participant.name)}
                >
                  <UserX className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
};