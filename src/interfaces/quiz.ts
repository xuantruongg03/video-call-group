
interface QuizSidebarProps {
    roomId: string;
    isOpen: boolean;
    onClose: () => void;
}

interface QuizOption {
    id: string;
    text: string;
    isCorrect: boolean;
}

interface QuizQuestion {
    id: string;
    text: string;
    type: 'multiple-choice' | 'essay' | 'one-choice';
    options?: QuizOption[];
    correctAnswers?: string[];
    answer?: string;
}

interface QuizSession {
    id: string;
    creatorId: string;
    title: string;
    questions: QuizQuestion[];
    participants: any[];
    isActive: boolean;
    createdAt: Date;
}

interface QuizResultsData {
    quizId: string;
    score: number;
    totalPossibleScore: number;
    startedAt: Date;
    finishedAt: Date;
    answers: {
        questionId: string;
        text: string;
        type: 'multiple-choice' | 'essay' | 'one-choice';
        correctAnswers?: string[];
        selectedOptions: string[];
        essayAnswer: string;
        modelAnswer: string;
    }[];
}

interface QuizParticipantResponse {
    participantId: string;
    quizId: string;
    questions: {
        questionId: string;
        type: 'multiple-choice' | 'essay' | 'one-choice';
        selectedOptions?: string[];
        essayAnswer?: string;
    }[];
  } 
  
  interface QuizTakingViewProps {
    roomId: string;
    username: string;
    quiz: QuizSession;
    onComplete: (results: QuizResultsData) => void;
  }

export type { QuizSidebarProps, QuizOption, QuizQuestion, QuizSession, QuizResultsData, QuizTakingViewProps, QuizParticipantResponse };
