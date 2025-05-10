import { QuizResultsData } from '@/interfaces/quiz';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface QuizResultsViewProps {
  results: QuizResultsData;
}

export const QuizResultsView = ({ results }: QuizResultsViewProps) => {
  const scorePercentage = results.totalPossibleScore > 0
    ? Math.round((results.score / results.totalPossibleScore) * 100)
    : 0;

  const getScoreColor = () => {
    if (scorePercentage >= 80) return 'text-green-600';
    if (scorePercentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOptionText = (answer: QuizResultsData['answers'][number], optionId: string) => {
    if (answer.options) {
      const option = answer.options.find(opt => opt.id === optionId);
      if (option) return option.text;
    }
    return optionId;
  };

  const multipleChoiceAnswers = results.answers.filter(a => a.type === 'multiple-choice' || a.type === 'one-choice');

  const essayAnswers = results.answers.filter(a => a.type === 'essay');

  return (
    <div className="space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center py-2 sm:py-4"
      >
        {/* <h3 className="text-base sm:text-xl font-semibold mb-1 sm:mb-2">Kết quả</h3> */}

        {results.totalPossibleScore > 0 ? (
          <>
            <div className={`text-xl sm:text-3xl font-bold ${getScoreColor()}`}>
              {results.score}/{results.totalPossibleScore}
            </div>
            <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-gray-500">
              Tỷ lệ đúng: {scorePercentage}%
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 sm:h-2.5 mt-3 sm:mt-4">
              <motion.div
                className={`h-2 sm:h-2.5 rounded-full ${scorePercentage >= 80 ? 'bg-green-600' :
                    scorePercentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                initial={{ width: 0 }}
                animate={{ width: `${scorePercentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
              ></motion.div>
            </div>
          </>
        ) : (
          <div className="text-xs sm:text-sm text-gray-500">Không có câu trắc nghiệm nào cần chấm điểm</div>
        )}
      </motion.div>

      {multipleChoiceAnswers.length > 0 && (
        <div className="mt-4 sm:mt-8">
          <h4 className="text-sm sm:text-lg font-medium mb-2 sm:mb-4">Câu trắc nghiệm</h4>
          <div className="space-y-3 sm:space-y-4">
            {multipleChoiceAnswers.map((answer, index) => {
              const isCorrect = answer.correctAnswers &&
                answer.selectedOptions.length === answer.correctAnswers.length &&
                answer.selectedOptions.every(option => answer.correctAnswers?.includes(option));

              return (
                <motion.div
                  key={answer.questionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="border rounded-md p-3 sm:p-4"
                >
                  <div className="flex items-start gap-2 sm:gap-3">
                    {isCorrect ? (
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h5 className="text-sm sm:text-base font-medium">Câu {index + 1}. {answer.text}</h5>
                      <div className="mt-2 text-xs sm:text-sm">
                        <div className="text-gray-500 mb-1">Câu trả lời:</div>
                        {answer.selectedOptions.length > 0 ? (
                          <ul className="list-disc list-inside">
                            {answer.selectedOptions.map(optionId => {
                              const option = answer.correctAnswers?.includes(optionId);
                              return (
                                <li key={optionId} className={option ? 'text-green-600' : 'text-red-600'}>
                                  {getOptionText(answer, optionId)}
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="text-gray-400 italic">Không có câu trả lời</div>
                        )}
                      </div>
                      {/* {!isCorrect && answer.correctAnswers && answer.correctAnswers.length > 0 && (
                        <div className="mt-2 text-xs sm:text-sm">
                          <div className="text-gray-500 mb-1">Đáp án đúng:</div>
                          <ul className="list-disc list-inside text-green-600">
                            {answer.correctAnswers.map(optionId => (
                              <li key={optionId}>{getOptionText(answer, optionId)}</li>
                            ))}
                          </ul>
                        </div>
                      )} */}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {essayAnswers.length > 0 && (
        <div className="mt-4 sm:mt-8">
          <h4 className="text-sm sm:text-lg font-medium mb-2 sm:mb-4">Câu tự luận</h4>
          <div className="space-y-3 sm:space-y-4">
            {essayAnswers.map((answer, index) => (
              <motion.div
                key={answer.questionId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="border rounded-md p-3 sm:p-4"
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-sm sm:text-base font-medium">{multipleChoiceAnswers.length + index + 1}. {answer.text}</h5>
                    <div className="mt-2 text-xs sm:text-sm">
                      <div className="text-gray-500 mb-1">Câu trả lời của bạn:</div>
                      {answer.essayAnswer ? (
                        <div className="p-2 bg-gray-50 rounded border text-xs sm:text-sm">{answer.essayAnswer}</div>
                      ) : (
                        <div className="text-gray-400 italic">Không có câu trả lời</div>
                      )}

                      {answer.modelAnswer && (
                        <div className="mt-2 sm:mt-3">
                          <div className="text-gray-500 mb-1">Đáp án mẫu:</div>
                          <div className="p-2 bg-blue-50 rounded border border-blue-100 text-xs sm:text-sm">{answer.modelAnswer}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 