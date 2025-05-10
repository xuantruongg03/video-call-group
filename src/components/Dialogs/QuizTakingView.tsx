import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { sfuSocket } from '@/hooks/use-call';
import { CheckCircle, FileText, ArrowRight, ArrowLeft, CircleCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { QuizParticipantResponse, QuizResultsData, QuizSession, QuizTakingViewProps } from '@/interfaces/quiz';

export const QuizTakingView = ({ roomId, username, quiz, onComplete }: QuizTakingViewProps) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizParticipantResponse>({
    participantId: username,
    quizId: quiz.id,
    questions: quiz.questions.map(question => ({
      questionId: question.id,
      type: question.type,
      selectedOptions: [],
      essayAnswer: '',
    })),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasParticipated, setHasParticipated] = useState(false);

  // Check if the user has already participated
  useEffect(() => {
    const participantEntry = quiz.participants.find(p => p.participantId === username);
    if (participantEntry && participantEntry.completed) {
      setHasParticipated(true);
    }
  }, [quiz, username]);

  const currentQuestion = quiz.questions[currentQuestionIndex];

  const handleSelectOption = (optionId: string) => {
    setAnswers(prev => {
      const questionId = currentQuestion.id;
      const prevAnswer = prev.questions.find(q => q.questionId === questionId) || { selectedOptions: [], essayAnswer: '' };

      let newSelectedOptions: string[];

      if (currentQuestion.type === 'one-choice') {
        newSelectedOptions = [optionId];
      } else {
        if (prevAnswer.selectedOptions.includes(optionId)) {
          newSelectedOptions = prevAnswer.selectedOptions.filter(id => id !== optionId);
        } else {
          newSelectedOptions = [...prevAnswer.selectedOptions, optionId];
        }
      }

      return {
        ...prev,
        questions: prev.questions.map(q => q.questionId === questionId ? { ...q, selectedOptions: newSelectedOptions } : q)
      };
    });
  };

  const handleEssayChange = (text: string) => {
    setAnswers(prev => {
      const questionId = currentQuestion.id;

      return {
        ...prev,
        questions: prev.questions.map(q => q.questionId === questionId ? { ...q, essayAnswer: text } : q)
      };
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsSubmitting(true);

    sfuSocket.emit('sfu:complete-quiz', {
      roomId,
      participantId: username,
      answers: answers
    }, (response: { success: boolean, error?: string, results?: QuizResultsData }) => {
      setIsSubmitting(false);

      if (response.success) {
        toast.success("Đã hoàn thành bài kiểm tra");
        onComplete(response.results);
    }
    });
  };

  if (hasParticipated) {
    return (
      <div className="text-center py-4 sm:py-8">
        <CheckCircle className="h-8 w-8 sm:h-12 sm:w-12 text-green-500 mx-auto mb-2 sm:mb-4" />
        <h3 className="text-base sm:text-xl font-semibold mb-1 sm:mb-2">Bạn đã hoàn thành bài kiểm tra này</h3>
        <p className="text-xs sm:text-sm text-gray-500 mb-2 sm:mb-4">Kết quả của bạn đã được ghi nhận.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm sm:text-lg font-semibold">{quiz.title}</h3>
        <div className="text-xs sm:text-sm font-medium">
          Câu {currentQuestionIndex + 1}/{quiz.questions.length}
        </div>
      </div>

      <motion.div
        key={currentQuestion.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="space-y-3 sm:space-y-4"
      >
        <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
          <div className="flex items-start gap-2 sm:gap-3">
            {currentQuestion.type === 'multiple-choice' ? (
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5" />
            ) : currentQuestion.type === 'one-choice' ? (
              <CircleCheck className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mt-0.5" />
            ) : (
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 mt-0.5" />
            )}
            <div>
              <h4 className="font-medium text-sm sm:text-base text-gray-900">{currentQuestion.text}</h4>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {currentQuestion.type === 'multiple-choice'
                  ? 'Chọn một hoặc nhiều tùy chọn đúng'
                  : currentQuestion.type === 'one-choice'
                    ? 'Chọn một đáp án đúng'
                    : 'Nhập câu trả lời của bạn vào ô dưới đây'}
              </p>
            </div>
          </div>
        </div>

        {currentQuestion.type === 'multiple-choice' && currentQuestion.options && (
          <div>
            {currentQuestion.options.map((option) => {
              const currentAnswer = answers.questions.find(q => q.questionId === currentQuestion.id);
              const isSelected = currentAnswer?.selectedOptions.includes(option.id) || false;

              return (
                <div
                  key={option.id}
                  className={`p-2 sm:p-3 border rounded-md mb-2 cursor-pointer transition-colors ${isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  onClick={() => handleSelectOption(option.id)}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <Checkbox checked={isSelected} className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-sm sm:text-base">{option.text}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {currentQuestion.type === 'one-choice' && currentQuestion.options && (
          <RadioGroup
            value={answers.questions.find(q => q.questionId === currentQuestion.id)?.selectedOptions[0] || ''}
            onValueChange={(value) => handleSelectOption(value)}
            className="space-y-2"
          >
            {currentQuestion.options.map((option) => {
              const currentAnswer = answers.questions.find(q => q.questionId === currentQuestion.id);
              const isSelected = currentAnswer?.selectedOptions.includes(option.id) || false;
              return (
                <div
                  key={option.id}
                  className={`p-2 sm:p-3 border rounded-md cursor-pointer transition-colors ${isSelected ? 'border-green-500 bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  onClick={() => handleSelectOption(option.id)}
                >
                  <div className="flex items-center space-x-2 sm:space-x-3">
                    <RadioGroupItem value={option.id} id={option.id} className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <span className="text-sm sm:text-base">{option.text}</span>
                  </div>
                </div>
              )
            })}
          </RadioGroup>
        )}

        {currentQuestion.type === 'essay' && (
          <div className="space-y-2">
            <Textarea
              placeholder="Nhập câu trả lời của bạn..."
              className="min-h-[100px] sm:min-h-[150px] text-sm sm:text-base"
              value={answers.questions.find(q => q.questionId === currentQuestion.id)?.essayAnswer || ''}
              onChange={(e) => handleEssayChange(e.target.value)}
            />
          </div>
        )}
      </motion.div>

      <div className="flex justify-between pt-2 sm:pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="flex items-center text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4"
        >
          <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
          Trước
        </Button>

        {currentQuestionIndex < quiz.questions.length - 1 ? (
          <Button
            type="button"
            onClick={handleNext}
            className="flex items-center text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-4"
          >
            Tiếp
            <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleComplete}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-xs sm:text-sm py-1 px-3 sm:py-2 sm:px-4"
          >
            {isSubmitting ? "Đang xử lý..." : "Hoàn thành"}
          </Button>
        )}
      </div>
    </div>
  );
}; 