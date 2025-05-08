import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { sfuSocket } from "@/hooks/use-call";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, BarChart3, Check, Plus, Trash2, Vote, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "sonner";
import { z } from "zod";

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

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } }
};

const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const listItem = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const progressBar = {
  hidden: { width: 0 },
  visible: width => ({
    width: `${width}%`,
    transition: { duration: 0.6, ease: "easeOut" }
  })
};

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

  const form = useForm<z.infer<typeof voteSchema>>({
    resolver: zodResolver(voteSchema),
    defaultValues: {
      question: "",
      options: ["", ""],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options" as never,
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
    if (!user.isCreator) {
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
    if (fields.length >= 5) return;
    append("");
  };

  const removeOption = (index: number) => {
    if (fields.length <= 2) return;
    remove(index);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <DialogTitle className="text-center flex items-center justify-center gap-2">
              <motion.div
                initial={{ rotate: -10, scale: 0.9 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ duration: 0.4, type: "spring" }}
              >
                <Vote className="h-5 w-5" />
              </motion.div>
              Bỏ Phiếu Kín
            </DialogTitle>
            <DialogDescription className="text-center">
              {activeTab === "create" && "Tạo một cuộc bỏ phiếu kín để thu thập ý kiến"}
              {activeTab === "vote" && "Tham gia bỏ phiếu"}
              {activeTab === "results" && "Kết quả bỏ phiếu"}
            </DialogDescription>
          </motion.div>
        </DialogHeader>

        <motion.div 
          className="flex border-b mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <button
            className={`px-4 py-2 relative ${activeTab === "create" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => !activeVote && setActiveTab("create")}
            disabled={!!activeVote}
          >
            Tạo
            {activeTab === "create" && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                layoutId="activeTab"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            className={`px-4 py-2 relative ${activeTab === "vote" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => activeVote && setActiveTab("vote")}
            disabled={!activeVote}
          >
            Bỏ phiếu
            {activeTab === "vote" && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                layoutId="activeTab"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
          <button
            className={`px-4 py-2 relative ${activeTab === "results" ? "border-b-2 border-blue-500" : ""}`}
            onClick={() => hasVoted && setActiveTab("results")}
            disabled={!hasVoted}
          >
            Kết quả
            {activeTab === "results" && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                layoutId="activeTab"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeTab === "create" && (
            <motion.div
              key="create"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              variants={fadeIn}
            >
              {!user.isCreator ? (
                <motion.div 
                  className="flex flex-col items-center justify-center py-6 text-center"
                  variants={slideUp}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <AlertTriangle className="h-12 w-12 text-amber-500 mb-3" />
                  </motion.div>
                  <h3 className="text-lg font-medium mb-2">Không có quyền tạo phiên bỏ phiếu</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Chỉ người tổ chức phòng họp mới có thể tạo phiên bỏ phiếu.
                  </p>
                  <Button type="button" variant="outline" onClick={onClose}>
                    Đóng
                  </Button>
                </motion.div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <motion.div variants={slideUp}>
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
                    </motion.div>

                    <motion.div 
                      className="space-y-2"
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                    >
                      <FormLabel>Các tùy chọn</FormLabel>
                      {fields.map((field, index) => (
                        <motion.div 
                          key={field.id} 
                          className="flex items-center gap-2"
                          variants={listItem}
                        >
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
                            disabled={fields.length <= 2}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addOption}
                          className="w-full mt-2"
                          disabled={fields.length >= 5}
                          title="Thêm tùy chọn"
                        >
                          <Plus className="h-4 w-4 mr-2" /> Thêm tùy chọn
                        </Button>
                      </motion.div>
                    </motion.div>

                    <motion.div
                      variants={fadeIn}
                      className="pt-2"
                    >
                      <DialogFooter className="sm:justify-center gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                          Hủy
                        </Button>
                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                          <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-blue-400 focus-visible:ring-0"
                          >
                            {isSubmitting ? "Đang xử lý..." : "Tạo phiên bỏ phiếu"}
                          </Button>
                        </motion.div>
                      </DialogFooter>
                    </motion.div>
                  </form>
                </Form>
              )}
            </motion.div>
          )}

          {activeTab === "vote" && activeVote && (
            <motion.div 
              key="vote"
              className="space-y-4"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              variants={fadeIn}
            >
              <motion.div 
                className="text-center font-medium text-lg"
                variants={slideUp}
              >
                {activeVote.question}
              </motion.div>
              
              {hasVoted ? (
                <motion.div 
                  className="text-center text-green-600 flex items-center justify-center gap-2"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Check className="h-5 w-5" /> Bạn đã bỏ phiếu
                </motion.div>
              ) : (
                <motion.div 
                  className="space-y-2"
                  variants={staggerContainer}
                >
                  {activeVote.options.map((option) => (
                    <motion.div
                      key={option.id}
                      className={`p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedOption === option.id ? "border-blue-500 bg-blue-50" : ""
                      }`}
                      onClick={() => setSelectedOption(option.id)}
                      variants={listItem}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {option.text}
                      {selectedOption === option.id && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          <Check className="h-4 w-4 inline-block ml-2 text-blue-500" />
                        </motion.span>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}

              <motion.div variants={fadeIn}>
                <DialogFooter className="sm:justify-center gap-2">
                  {activeVote.creatorId === user.username && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleEndVote}
                        className="flex items-center gap-2"
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" /> Kết thúc
                      </Button>
                    </motion.div>
                  )}
                  
                  {!hasVoted && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        disabled={!selectedOption || isSubmitting}
                        onClick={handleVote}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus-visible:outline-blue-400 focus-visible:ring-0"
                      >
                        {isSubmitting ? "Đang xử lý..." : "Bỏ phiếu"}
                      </Button>
                    </motion.div>
                  )}
                  
                  {hasVoted && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        onClick={() => setActiveTab("results")}
                        className="flex items-center gap-2"
                      >
                        <BarChart3 className="h-4 w-4" /> Xem kết quả
                      </Button>
                    </motion.div>
                  )}
                </DialogFooter>
              </motion.div>
            </motion.div>
          )}

          {activeTab === "results" && activeVote && (
            <motion.div 
              key="results"
              className="space-y-4"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              variants={fadeIn}
            >
              <motion.div 
                className="text-center font-medium text-lg"
                variants={slideUp}
              >
                {activeVote.question}
              </motion.div>
              <motion.div 
                className="text-sm text-gray-500 text-center"
                variants={slideUp}
              >
                {totalVotes} phiếu bầu
              </motion.div>
              
              <motion.div 
                className="space-y-3"
                variants={staggerContainer}
              >
                {voteResults.map((option) => {
                  const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
                  
                  return (
                    <motion.div 
                      key={option.id} 
                      className="space-y-1"
                      variants={listItem}
                    >
                      <div className="flex justify-between text-sm">
                        <span>{option.text}</span>
                        <motion.span 
                          className="font-medium"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                        >
                          {percentage}%
                        </motion.span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <motion.div
                          className="bg-blue-600 h-2.5 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                        ></motion.div>
                      </div>
                      <motion.div 
                        className="text-xs text-gray-500"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7, duration: 0.3 }}
                      >
                        {option.votes} phiếu
                      </motion.div>
                    </motion.div>
                  );
                })}
              </motion.div>

              <motion.div variants={fadeIn}>
                <DialogFooter className="sm:justify-center gap-2">
                  {activeVote.creatorId === user.username && (
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleEndVote}
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" /> Kết thúc phiên bỏ phiếu
                      </Button>
                    </motion.div>
                  )}
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button type="button" variant="outline" onClick={onClose}>
                      Đóng
                    </Button>
                  </motion.div>
                </DialogFooter>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}; 