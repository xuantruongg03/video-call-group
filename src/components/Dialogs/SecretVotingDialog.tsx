import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Vote, Check, Plus, X, Trash2, BarChart3, AlertTriangle } from "lucide-react";
import { sfuSocket } from "@/hooks/use-call";
import { useSelector } from "react-redux";
import { toast } from "sonner";

interface SecretVotingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

const voteSchema = z.object({
  question: z.string().min(1, "Câu hỏi không được để trống"),
  options: z.array(z.string().min(1, "Tùy chọn không được để trống")).min(2, "Phải có ít nhất 2 tùy chọn"),
});

interface VoteOption {
  id: string;
  text: string;
  votes: number;
}

interface VoteSession {
  id: string;
  creatorId: string;
  question: string;
  options: VoteOption[];
  participants: string[];
  isActive: boolean;
  createdAt: Date;
}

export const SecretVotingDialog = ({
  isOpen,
  onClose,
  roomId,
}: SecretVotingDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"create" | "vote" | "results">("create");
  const [activeVote, setActiveVote] = useState<VoteSession | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const user = useSelector((state: any) => state.room);
  const [voteResults, setVoteResults] = useState<VoteOption[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const room = useSelector((state: any) => state.room);

  const form = useForm<z.infer<typeof voteSchema>>({
    resolver: zodResolver(voteSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
    },
  });

  useEffect(() => {
    sfuSocket.on("sfu:vote-session", (data: VoteSession) => {
      setActiveVote(data);
      setActiveTab("vote");
      setHasVoted(data.participants.includes(user.username));
    });

    sfuSocket.on("sfu:vote-results", (data: { options: VoteOption[], totalVotes: number }) => {
      setVoteResults(data.options);
      setTotalVotes(data.totalVotes);
      setActiveTab("results");
    });

    sfuSocket.emit("sfu:get-active-vote", { roomId }, (response: { activeVote: VoteSession | null }) => {
      if (response.activeVote) {
        setActiveVote(response.activeVote);
        setHasVoted(response.activeVote.participants.includes(user.username));
        
        if (response.activeVote.participants.includes(user.username)) {
          sfuSocket.emit("sfu:get-vote-results", { 
            roomId, 
            voteId: response.activeVote.id 
          });
        } else {
          setActiveTab("vote");
        }
      }
    });

    return () => {
      sfuSocket.off("sfu:vote-session");
      sfuSocket.off("sfu:vote-results");
    };
  }, [roomId, user.username]);

  const handleSubmit = (values: z.infer<typeof voteSchema>) => {
    if (!room.isCreator) {
      toast.error("Chỉ người tổ chức mới có thể tạo phiên bỏ phiếu");
      return;
    }
    
    setIsSubmitting(true);
    
    const options = values.options.map((option) => ({
      id: Math.random().toString(36).substring(2, 9),
      text: option,
      votes: 0
    }));

    sfuSocket.emit("sfu:create-vote", {
      roomId,
      question: values.question,
      options,
      creatorId: user.username
    }, (response: { success: boolean, error?: string }) => {
      setIsSubmitting(false);
      
      if (response.success) {
        toast.success("Đã tạo phiên bỏ phiếu thành công");
        setActiveTab("vote");
      } else {
        toast.error(response.error || "Không thể tạo phiên bỏ phiếu");
      }
    });
  };

  const handleVote = () => {
    if (!selectedOption || !activeVote) return;
    
    setIsSubmitting(true);
    sfuSocket.emit("sfu:submit-vote", {
      roomId,
      voteId: activeVote.id,
      optionId: selectedOption,
      voterId: user.username
    }, (response: { success: boolean, error?: string }) => {
      setIsSubmitting(false);
      
      if (response.success) {
        setHasVoted(true);
        toast.success("Đã bỏ phiếu thành công");
        
        // Get results after voting
        sfuSocket.emit("sfu:get-vote-results", { 
          roomId, 
          voteId: activeVote.id 
        });
      } else {
        toast.error(response.error || "Không thể bỏ phiếu");
      }
    });
  };

  const handleEndVote = () => {
    if (!activeVote) return;
    
    sfuSocket.emit("sfu:end-vote", {
      roomId,
      voteId: activeVote.id,
      creatorId: user.username
    }, (response: { success: boolean, error?: string }) => {
      if (response.success) {
        toast.success("Đã kết thúc phiên bỏ phiếu");
        setActiveVote(null);
        setActiveTab("create");
      } else {
        toast.error(response.error || "Không thể kết thúc phiên bỏ phiếu");
      }
    });
  };

  const addOption = () => {
    const currentOptions = form.getValues().options;
    form.setValue("options", [...currentOptions, ""]);
  };

  const removeOption = (index: number) => {
    const currentOptions = form.getValues().options;
    if (currentOptions.length <= 2) return;
    
    const newOptions = [...currentOptions];
    newOptions.splice(index, 1);
    form.setValue("options", newOptions);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Vote className="h-5 w-5" /> Bỏ Phiếu Kín
          </DialogTitle>
          <DialogDescription className="text-center">
            {activeTab === "create" && "Tạo một cuộc bỏ phiếu kín để thu thập ý kiến"}
            {activeTab === "vote" && "Tham gia bỏ phiếu"}
            {activeTab === "results" && "Kết quả bỏ phiếu"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 ${activeTab === "create" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => !activeVote && setActiveTab("create")}
            disabled={!!activeVote}
          >
            Tạo
          </button>
          <button
            className={`px-4 py-2 ${activeTab === "vote" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => activeVote && setActiveTab("vote")}
            disabled={!activeVote}
          >
            Bỏ phiếu
          </button>
          <button
            className={`px-4 py-2 ${activeTab === "results" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => hasVoted && setActiveTab("results")}
            disabled={!hasVoted}
          >
            Kết quả
          </button>
        </div>

        {activeTab === "create" && (
          <>
            {!room.isCreator ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
                <h3 className="text-lg font-medium mb-2">Không có quyền tạo phiên bỏ phiếu</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Chỉ người tổ chức phòng họp mới có thể tạo phiên bỏ phiếu.
                </p>
                <Button type="button" variant="outline" onClick={onClose}>
                  Đóng
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Câu hỏi</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nhập câu hỏi bỏ phiếu"
                            className="w-full focus-visible:outline-blue-400 focus-visible:ring-0"
                            {...field}
                            autoFocus
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <FormLabel>Các tùy chọn</FormLabel>
                    {form.getValues().options.map((_, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <FormField
                          control={form.control}
                          name={`options.${index}`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormControl>
                                <Input
                                  placeholder={`Tùy chọn ${index + 1}`}
                                  className="w-full focus-visible:outline-blue-400 focus-visible:ring-0"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(index)}
                          disabled={form.getValues().options.length <= 2}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addOption}
                      className="w-full mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" /> Thêm tùy chọn
                    </Button>
                  </div>

                  <DialogFooter className="sm:justify-center gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                      Hủy
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-blue-400 focus-visible:ring-0"
                    >
                      {isSubmitting ? "Đang xử lý..." : "Tạo phiên bỏ phiếu"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            )}
          </>
        )}

        {activeTab === "vote" && activeVote && (
          <div className="space-y-4">
            <div className="text-center font-medium text-lg">{activeVote.question}</div>
            
            {hasVoted ? (
              <div className="text-center text-green-600 flex items-center justify-center gap-2">
                <Check className="h-5 w-5" /> Bạn đã bỏ phiếu
              </div>
            ) : (
              <div className="space-y-2">
                {activeVote.options.map((option) => (
                  <div
                    key={option.id}
                    className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedOption === option.id ? "border-blue-500 bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedOption(option.id)}
                  >
                    {option.text}
                    {selectedOption === option.id && (
                      <Check className="h-4 w-4 inline-block ml-2 text-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <DialogFooter className="sm:justify-center gap-2">
              {activeVote.creatorId === user.username && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleEndVote}
                  className="flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  <Trash2 className="h-4 w-4" /> Kết thúc
                </Button>
              )}
              
              {!hasVoted && (
                <Button
                  type="button"
                  disabled={!selectedOption || isSubmitting}
                  onClick={handleVote}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-blue-400 focus-visible:ring-0"
                >
                  {isSubmitting ? "Đang xử lý..." : "Bỏ phiếu"}
                </Button>
              )}
              
              {hasVoted && (
                <Button
                  type="button"
                  onClick={() => setActiveTab("results")}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" /> Xem kết quả
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {activeTab === "results" && activeVote && (
          <div className="space-y-4">
            <div className="text-center font-medium text-lg">{activeVote.question}</div>
            <div className="text-sm text-gray-500 text-center">{totalVotes} phiếu bầu</div>
            
            <div className="space-y-3">
              {voteResults.map((option) => {
                const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                
                return (
                  <div key={option.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{option.text}</span>
                      <span className="font-medium">{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500">{option.votes} phiếu</div>
                  </div>
                );
              })}
            </div>

            <DialogFooter className="sm:justify-center gap-2">
              {activeVote.creatorId === user.username && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleEndVote}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Kết thúc phiên bỏ phiếu
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose}>
                Đóng
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}; 