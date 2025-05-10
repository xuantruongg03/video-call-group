import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { sfuSocket } from '@/hooks/use-call';
import { QuizOption, QuizResultsData, QuizSession, QuizSidebarProps } from '@/interfaces/quiz';
import CONSTANT from '@/lib/constant';
import { compareAnswer, getQuizType } from '@/lib/utils';
import { quizSchema } from '@/lib/validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, ChevronRight, FileText, Plus, Trash, Upload, User } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { QuizResultsView } from './Dialogs/QuizResultsView';
import { QuizTakingView } from './Dialogs/QuizTakingView';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle
} from "./ui/sheet";

export const QuizSidebar = ({ isOpen, onClose, roomId }: QuizSidebarProps) => {
    const [activeTab, setActiveTab] = useState<"create" | "take" | "results">("create");
    const [activeQuiz, setActiveQuiz] = useState<QuizSession | null>(null);
    const [quizResults, setQuizResults] = useState<QuizResultsData | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const user = useSelector((state: any) => state.room);
    const [isQuizInProgress, setIsQuizInProgress] = useState(false);
    const [allStudentResults, setAllStudentResults] = useState<{participantId: string, results: QuizResultsData}[]>([]);
    const [selectedStudentResult, setSelectedStudentResult] = useState<string | null>(null);

    const form = useForm<z.infer<typeof quizSchema>>({
        resolver: zodResolver(quizSchema),
        defaultValues: {
            title: "",
            questions: [
                {
                    text: "",
                    type: "one-choice",
                    options: [
                        { text: "", isCorrect: false },
                        { text: "", isCorrect: false },
                    ],
                    answer: "",
                },
            ],
        },
    });

    const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
        control: form.control,
        name: "questions",
    });

    const addQuestion = (type: 'multiple-choice' | 'essay' | 'one-choice') => {
        if (type === 'multiple-choice') {
            appendQuestion({
                text: "",
                type: "multiple-choice",
                options: [
                    { text: "", isCorrect: false },
                    { text: "", isCorrect: false },
                ],
            });
        } else if (type === 'one-choice') {
            appendQuestion({
                text: "",
                type: "one-choice",
                options: [
                    { text: "", isCorrect: true },
                    { text: "", isCorrect: false },
                ],
            });
        } else {
            appendQuestion({
                text: "",
                type: "essay",
                answer: "",
            });
        }
    };

    const addOption = (questionIndex: number) => {
        const options = form.getValues(`questions.${questionIndex}.options`) || [];
        if (options.length >= CONSTANT.MAX_OPTIONS_QUIZ) return;

        const questionType = form.getValues(`questions.${questionIndex}.type`);
        const newOption = { 
            text: "", 
            isCorrect: false 
        };

        if (questionType === 'one-choice' && !options.some(opt => opt.isCorrect)) {
            newOption.isCorrect = true;
        }

        form.setValue(`questions.${questionIndex}.options`, [
            ...options,
            newOption,
        ]);
    };

    const removeOption = (questionIndex: number, optionIndex: number) => {
        const options = form.getValues(`questions.${questionIndex}.options`) || [];
        if (options.length <= CONSTANT.MIN_OPTIONS_QUIZ) return;

        const newOptions = [...options];
        newOptions.splice(optionIndex, 1);
        form.setValue(`questions.${questionIndex}.options`, newOptions);
    };

    const handleOptionCorrectChange = (questionIndex: number, optionIndex: number, value: boolean) => {
        const questionType = form.getValues(`questions.${questionIndex}.type`);
        const options = form.getValues(`questions.${questionIndex}.options`) || [];

        if (questionType === 'one-choice' && value) {
            const updatedOptions = options.map((opt, idx) => ({
                ...opt,
                isCorrect: idx === optionIndex
            }));
            form.setValue(`questions.${questionIndex}.options`, updatedOptions);
        } else {
            form.setValue(`questions.${questionIndex}.options.${optionIndex}.isCorrect`, value);
        }
    };

    const handleFileUpload = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                const type = getQuizType(jsonData[0]['Loại câu hỏi']);
                if (type === 'unknown') {
                    toast.error('Định dạng file không hợp lệ');
                    return;
                }
                let options = [];

                let questions = jsonData.map((row: any) => {
                    
                    if (row.__EMPTY_4) {
                        return null;
                    }
                    if (type === 'one-choice') {
                        options = [
                            {
                                text: row['Đáp án A'],
                                isCorrect: row['Đáp án đúng'] === 'A'
                            },
                            {
                                text: row['Đáp án B'],
                                isCorrect: row['Đáp án đúng'] === 'B'
                            },
                        ];
                        if (row['Đáp án C'] !== '') {
                            options.push({
                                text: row['Đáp án C'],
                                isCorrect: row['Đáp án đúng'] === 'C'
                            });
                        }
                        if (row['Đáp án D'] !== '') {
                            options.push({
                                text: row['Đáp án D'],
                                isCorrect: row['Đáp án đúng'] === 'D'
                            });
                        }
                    } else if (type === 'multiple-choice') {
                        options = [
                            {
                                id: nanoid(),
                                text: row['Đáp án A'],
                                isCorrect: compareAnswer(row['Đáp án đúng'], 'a')
                            },
                            {
                                id: nanoid(),
                                text: row['Đáp án B'],
                                isCorrect: compareAnswer(row['Đáp án đúng'], 'b')
                            },
                            {
                                id: nanoid(),
                                text: row['Đáp án C'],
                                isCorrect: compareAnswer(row['Đáp án đúng'], 'c')
                            }
                        ];
                        if (row['Đáp án D'].toLowerCase().trim() !== '') {
                            options.push({
                                id: nanoid(),
                                text: row['Đáp án D'],
                                isCorrect: compareAnswer(row['Đáp án đúng'], 'd')
                            });
                        }
                    } 

                    return {
                        id: nanoid(),
                        text: row['Câu hỏi'],
                        type: type,
                        options: options
                    };
                });
                questions = questions.filter(question => question !== null);
                
                form.setValue('questions', questions as any);
                toast.success(`Đã tải lên ${questions.length} câu hỏi thành công`);

            } catch (error) {
                console.error('Error parsing Excel file:', error);
                toast.error('Có lỗi xảy ra khi đọc file. Vui lòng kiểm tra định dạng file.');
            }
        };

        reader.onerror = () => {
            toast.error('Có lỗi xảy ra khi đọc file');
        };

        reader.readAsBinaryString(file);
    };

    const handleCreateQuiz = (values: z.infer<typeof quizSchema>) => {
        if (!user.isCreator) {
            toast.error("Chỉ người tổ chức mới có thể tạo bài kiểm tra");
            return;
        }
        
        setIsSubmitting(true);

        const questions = values.questions.map(question => {
            const newQuestion: any = {
                id: nanoid(),
                text: question.text,
                type: question.type,
            };

            if (question.type === 'multiple-choice' && question.options) {
                newQuestion.options = question.options.map(option => ({
                    id: nanoid(),
                    text: option.text,
                    isCorrect: option.isCorrect,
                }));
                newQuestion.correctAnswers = newQuestion.options
                    .filter((option: QuizOption) => option.isCorrect)
                    .map((option: QuizOption) => option.id);
            } else if (question.type === 'essay') {
                newQuestion.answer = question.answer || '';
            } else if (question.type === 'one-choice') {
                newQuestion.options = question.options.map(option => ({
                    id: nanoid(),
                    text: option.text,
                    isCorrect: option.isCorrect,
                }));
                newQuestion.correctAnswers = newQuestion.options
                    .filter((option: QuizOption) => option.isCorrect)
                    .map((option: QuizOption) => option.id);
            }

            return newQuestion;
        });

        sfuSocket.emit('sfu:create-quiz', {
            roomId,
            title: values.title,
            questions,
            creatorId: user.username,
        }, (response: { success: boolean, error?: string, quizId?: string }) => {
            setIsSubmitting(false);

            if (response.success) {
                toast.success("Đã tạo bài kiểm tra thành công");
                setActiveTab("take");
            } else {
                toast.error(response.error || "Không thể tạo bài kiểm tra");
            }
        });
    };

    const handleQuizComplete = (results: QuizResultsData) => {
        setQuizResults(results);
        setIsQuizInProgress(false);
        setActiveTab('results');
    };

    useEffect(() => {
        if(isOpen) {
            if(user.isCreator) {
                setActiveTab('create');
            } else {
                setActiveTab('take');
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const onQuizSession = (data: QuizSession) => {
            setActiveQuiz(data);
            // setActiveTab('take');
        };

        const onQuizEnded = (data: { quizId: string }) => {
            toast.info("Bài kiểm tra đã kết thúc");
            
            if (quizResults && quizResults.quizId === data.quizId) {
                setActiveTab('results');
            } else if (activeQuiz && activeQuiz.id === data.quizId) {
                setActiveQuiz(null);
                setIsQuizInProgress(false);
                setActiveTab('create');
            }
        };

        sfuSocket.on('sfu:quiz-session', onQuizSession);
        sfuSocket.on('sfu:quiz-ended', onQuizEnded);

        if (isOpen && sfuSocket.connected) {
            sfuSocket.emit('sfu:get-active-quiz', { roomId }, (response: { activeQuiz: QuizSession | null }) => {
                if (response.activeQuiz) {
                    setActiveQuiz(response.activeQuiz);
                    
                    const participantEntry = response.activeQuiz.participants.find(p => p.participantId === user.username);
                    
                    if (participantEntry) {
                        // Nếu đã hoàn thành, lấy kết quả
                        if (participantEntry.completed) {
                            sfuSocket.emit('sfu:get-quiz-results', { 
                                quizId: response.activeQuiz.id, 
                                participantId: user.username 
                            }, (resultsResponse: { success: boolean, results?: QuizResultsData }) => {
                                if (resultsResponse.success && resultsResponse.results) {
                                    setQuizResults(resultsResponse.results);
                                    setActiveTab('results');
                                }
                            });
                        } 
                        // Nếu đang làm bài, set trạng thái đang làm bài
                        else if (participantEntry.started && !participantEntry.completed) {
                            setIsQuizInProgress(true);
                        }
                    }
                    
                    if (!user.isCreator) {
                        setActiveTab('take');
                    }
                }
            });
        }

        return () => {
            sfuSocket.off('sfu:quiz-session', onQuizSession);
            sfuSocket.off('sfu:quiz-ended', onQuizEnded);
        };
    }, [roomId, user.isCreator, user.username, isOpen]);

    const handleEndQuiz = () => {
        if (!activeQuiz || !user.isCreator) return;

        setIsSubmitting(true);
        sfuSocket.emit('sfu:end-quiz', {
            roomId,
            quizId: activeQuiz.id,
            creatorId: user.username
        }, (response: { success: boolean, error?: string }) => {
            setIsSubmitting(false);

            if (response.success) {
                toast.success("Đã kết thúc bài kiểm tra");
                setActiveQuiz(null);
                setActiveTab('create');
            } else {
                toast.error(response.error || "Không thể kết thúc bài kiểm tra");
            }
        });
    };

    const fetchAllStudentResults = () => {
        if (!activeQuiz || !user.isCreator) return;
        
        sfuSocket.emit('sfu:get-all-quiz-results', {
            roomId,
            quizId: activeQuiz.id
        }, (response: { success: boolean, allResults?: any[], error?: string }) => {
            if (response.success && response.allResults) {
                const formattedResults = response.allResults.map(result => ({
                    participantId: result.participantId,
                    results: {
                        quizId: result.quizId || activeQuiz.id,
                        score: result.score,
                        totalPossibleScore: result.totalPossibleScore,
                        startedAt: result.startedAt,
                        finishedAt: result.finishedAt,
                        answers: result.answers
                    }
                }));
                
                setAllStudentResults(formattedResults);
                
                if (formattedResults.length > 0) {
                    setSelectedStudentResult(formattedResults[0].participantId);
                    setQuizResults(formattedResults[0].results);
                }
            } else if (response.error) {
                toast.error(response.error);
            }
        });
    };

    const handleTabChange = (value: string) => {
        if (isQuizInProgress && !user.isCreator && value !== activeTab && value !== 'results') {
            toast.error("Không thể chuyển tab khi đang làm bài");
            return;
        }
        
        if (!activeQuiz && !user.isCreator && value === 'take') {
            toast.error("Chưa có bài kiểm tra nào được tạo");
            return;
        }
        
        if (!quizResults && !(user.isCreator && activeQuiz) && value === 'results') {
            toast.error("Chưa có kết quả bài kiểm tra");
            return;
        }
        
        if (value === 'results' && user.isCreator && activeQuiz) {
            fetchAllStudentResults();
        }
        
        setActiveTab(value as any);
    };

    const handleStartQuiz = () => {
        sfuSocket.emit('sfu:start-quiz', {
            roomId,
            quizId: activeQuiz?.id,
        }, (response: { success: boolean, error?: string }) => {
            if (response.success) {
                setIsQuizInProgress(true);
            } else {
                toast.error(response.error || "Không thể bắt đầu bài kiểm tra");
            }
        });
    };

    const disabledResultsTab = () => {
        if(!user.isCreator) {
            if(!quizResults || isQuizInProgress) {
                return true;
            }
        }
        return false;
    }

    const handleStudentChange = (studentId: string) => {
        const studentResult = allStudentResults.find(s => s.participantId === studentId);
        if (studentResult) {
            setSelectedStudentResult(studentId);
            setQuizResults(studentResult.results);
        }
    };

    return (
        <>
            <Sheet open={isOpen} onOpenChange={onClose}>
                <SheetContent side="right" className="w-full sm:max-w-[750px] md:max-w-[900px] p-0 border-l">
                    <div className="h-full flex flex-col">
                        <SheetHeader className="p-3 sm:p-4 border-b">
                            <div className="flex justify-between items-center">
                                <div>
                                    <SheetTitle className="text-base sm:text-lg">Bài kiểm tra</SheetTitle>
                                    <SheetDescription className="text-xs sm:text-sm">
                                        Tạo hoặc tham gia bài kiểm tra để đánh giá kiến thức.
                                    </SheetDescription>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={onClose}
                                    className="border"
                                >
                                    <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                                </Button>
                            </div>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-3 sm:p-6 scrollbar-sm">
                            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6">
                                    <TabsTrigger value="create" disabled={!user.isCreator} className="text-xs sm:text-sm">Tạo bài kiểm tra</TabsTrigger>
                                    <TabsTrigger value="take" disabled={!activeQuiz && !user.isCreator} className="text-xs sm:text-sm">Làm bài</TabsTrigger>
                                    <TabsTrigger value="results" disabled={disabledResultsTab()} className="text-xs sm:text-sm">Kết quả</TabsTrigger>
                                </TabsList>

                                <TabsContent value="create">
                                    <form onSubmit={form.handleSubmit(handleCreateQuiz)} className="space-y-4 sm:space-y-8 py-2 sm:py-4 max-w-4xl mx-auto focus-within:ring-0">
                                        {activeQuiz && activeQuiz.isActive ? (
                                            <div className="bg-orange-50 p-4 rounded-md border border-orange-200 mb-4">
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                                    <div>
                                                        <h3 className="text-base sm:text-lg font-medium text-orange-700">Đã có bài kiểm tra đang diễn ra</h3>
                                                        <p className="text-sm text-orange-600 mt-1">Vui lòng kết thúc bài kiểm tra hiện tại trước khi tạo bài mới.</p>
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={handleEndQuiz}
                                                        disabled={isSubmitting}
                                                        className="whitespace-nowrap text-xs sm:text-sm"
                                                    >
                                                        {isSubmitting ? "Đang xử lý..." : "Kết thúc bài kiểm tra"}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="space-y-2 sm:space-y-3">
                                                    <Label htmlFor="title" className="text-sm sm:text-lg">Tiêu đề bài kiểm tra</Label>
                                                    <Input
                                                        id="title"
                                                        placeholder="Nhập tiêu đề bài kiểm tra"
                                                        className="text-sm sm:text-lg py-2 sm:py-6 focus-visible:outline-blue-400 focus-visible:ring-0"
                                                        {...form.register("title")}
                                                    />
                                                    {form.formState.errors.title && (
                                                        <p className="text-xs sm:text-sm text-red-500">{form.formState.errors.title.message}</p>
                                                    )}
                                                </div>

                                                <div className="space-y-4 sm:space-y-6">
                                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
                                                        <Label className="text-sm sm:text-lg">Danh sách câu hỏi</Label>
                                                        <div className="flex flex-wrap gap-2 sm:space-x-3">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    const input = document.createElement('input');
                                                                    input.type = 'file';
                                                                    input.accept = '.xlsx, .xls';
                                                                    input.onchange = (e) => {
                                                                        const file = (e.target as HTMLInputElement).files?.[0];
                                                                        if (file) handleFileUpload(file);
                                                                    };
                                                                    input.click();
                                                                }}
                                                                className="text-xs sm:text-sm py-1 px-2 sm:py-5 sm:px-4 flex-1 sm:flex-auto"
                                                            >
                                                                <Upload className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                                                                <span className="whitespace-nowrap">Nhập bằng file</span>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => addQuestion('multiple-choice')}
                                                                className="text-xs sm:text-sm py-1 px-2 sm:py-5 sm:px-4 flex-1 sm:flex-auto"
                                                            >
                                                                <CheckCircle className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                                                                <span className="whitespace-nowrap">Thêm trắc nghiệm</span>
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => addQuestion('essay')}
                                                                className="text-xs sm:text-sm py-1 px-2 sm:py-5 sm:px-4 flex-1 sm:flex-auto"
                                                            >
                                                                <FileText className="h-3 w-3 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                                                                <span className="whitespace-nowrap">Thêm tự luận</span>
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {questionFields.map((field, questionIndex) => (
                                                        <div key={field.id} className="border p-3 sm:p-6 rounded-md space-y-3 sm:space-y-4 bg-slate-50">
                                                            <div className="flex justify-between items-start">
                                                                <Label htmlFor={`question-${questionIndex}`} className="text-sm sm:text-base font-medium">Câu hỏi {questionIndex + 1}</Label>
                                                                {questionFields.length > 1 && (
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        onClick={() => removeQuestion(questionIndex)}
                                                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                                                    >
                                                                        <Trash className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                    </Button>
                                                                )}
                                                            </div>

                                                            <div className="space-y-2 sm:space-y-3">
                                                                <Input
                                                                    id={`question-${questionIndex}`}
                                                                    placeholder="Nhập nội dung câu hỏi"
                                                                    className="text-sm sm:text-base py-2 sm:py-5 focus-visible:outline-blue-400 focus-visible:ring-0"
                                                                    {...form.register(`questions.${questionIndex}.text`)}
                                                                />
                                                                {form.formState.errors.questions?.[questionIndex]?.text && (
                                                                    <p className="text-xs sm:text-sm text-red-500">
                                                                        {form.formState.errors.questions?.[questionIndex]?.text?.message}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="space-y-1 sm:space-y-2">
                                                                <Label className="text-sm sm:text-base">Loại câu hỏi</Label>
                                                                <Controller
                                                                    control={form.control}
                                                                    name={`questions.${questionIndex}.type`}
                                                                    render={({ field }) => (
                                                                        <Select
                                                                            onValueChange={(value) => {
                                                                                field.onChange(value);
                                                                                if (value === 'multiple-choice') {
                                                                                    form.setValue(`questions.${questionIndex}.options`, [
                                                                                        { text: "", isCorrect: false },
                                                                                        { text: "", isCorrect: false },
                                                                                    ]);
                                                                                    form.setValue(`questions.${questionIndex}.answer`, undefined);
                                                                                } else if (value === 'one-choice') {
                                                                                    form.setValue(`questions.${questionIndex}.options`, [
                                                                                        { text: "", isCorrect: false },
                                                                                        { text: "", isCorrect: false },
                                                                                    ]);
                                                                                    form.setValue(`questions.${questionIndex}.answer`, undefined);
                                                                                }
                                                                                else {
                                                                                    form.setValue(`questions.${questionIndex}.options`, undefined);
                                                                                    form.setValue(`questions.${questionIndex}.answer`, "");
                                                                                }
                                                                            }}
                                                                            value={field.value}
                                                                        >
                                                                            <SelectTrigger className="w-full focus:ring-1 focus:ring-blue-500 sm:w-[250px] text-xs sm:text-sm focus-visible:outline-blue-400 focus-visible:ring-0">
                                                                                <SelectValue placeholder="Chọn loại câu hỏi" />
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                <SelectItem value="one-choice" className="text-xs sm:text-sm ">Trắc nghiệm 1 đáp án</SelectItem>
                                                                                <SelectItem value="multiple-choice" className="text-xs sm:text-sm ">Trắc nghiệm nhiều đáp án</SelectItem>
                                                                                <SelectItem value="essay" className="text-xs sm:text-sm ">Tự luận</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    )}
                                                                />
                                                            </div>

                                                            {/* Render multiple choice options or essay answer based on question type */}
                                                            {(form.watch(`questions.${questionIndex}.type`) === 'multiple-choice' || 
                                                              form.watch(`questions.${questionIndex}.type`) === 'one-choice') && (
                                                                <div className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                                                                    <div className="flex justify-between items-center">
                                                                        <Label className="text-sm sm:text-base">Các lựa chọn</Label>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() => addOption(questionIndex)}
                                                                            className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3"
                                                                        >
                                                                            <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                                                                            Thêm
                                                                        </Button>
                                                                    </div>

                                                                    <div className="grid gap-2 sm:gap-4">
                                                                        {form.watch(`questions.${questionIndex}.options`)?.map((option, optionIndex) => (
                                                                            <div key={optionIndex} className="flex items-start space-x-2 sm:space-x-3 bg-white p-2 sm:p-3 rounded-md">
                                                                                <div className="mt-2 sm:mt-3">
                                                                                    <Controller
                                                                                        control={form.control}
                                                                                        name={`questions.${questionIndex}.options.${optionIndex}.isCorrect`}
                                                                                        render={({ field }) => (
                                                                                            <Checkbox
                                                                                                checked={field.value}
                                                                                                onCheckedChange={(checked) => handleOptionCorrectChange(questionIndex, optionIndex, checked as boolean)}
                                                                                                className="h-4 w-4 sm:h-5 sm:w-5"
                                                                                            />
                                                                                        )}
                                                                                    />
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <Input
                                                                                        placeholder={`Lựa chọn ${optionIndex + 1}`}
                                                                                        className="text-sm sm:text-base py-1 sm:py-4 focus-visible:outline-blue-400 focus-visible:ring-0"
                                                                                        {...form.register(`questions.${questionIndex}.options.${optionIndex}.text`)}
                                                                                    />
                                                                                    {form.formState.errors.questions?.[questionIndex]?.options?.[optionIndex]?.text && (
                                                                                        <p className="text-xs sm:text-sm text-red-500 mt-1">
                                                                                            {form.formState.errors.questions?.[questionIndex]?.options?.[optionIndex]?.text?.message}
                                                                                        </p>
                                                                                    )}
                                                                                </div>
                                                                                {form.watch(`questions.${questionIndex}.options`)?.length > 2 && (
                                                                                    <Button
                                                                                        type="button"
                                                                                        size="sm"
                                                                                        variant="destructive"
                                                                                        onClick={() => removeOption(questionIndex, optionIndex)}
                                                                                        className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                                                                                    >
                                                                                        <Trash className="h-3 w-3 sm:h-4 sm:w-4" />
                                                                                    </Button>
                                                                                )}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {form.watch(`questions.${questionIndex}.type`) === 'essay' && (
                                                                <div className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                                                                    <Label htmlFor={`answer-${questionIndex}`} className="text-sm sm:text-base">Đáp án mẫu (không bắt buộc)</Label>
                                                                    <Textarea
                                                                        id={`answer-${questionIndex}`}
                                                                        placeholder="Nhập đáp án mẫu (nếu có)"
                                                                        className="min-h-[100px] sm:min-h-[150px] text-sm sm:text-base focus-visible:outline-blue-400 focus-visible:ring-0"
                                                                        {...form.register(`questions.${questionIndex}.answer`)}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex justify-end">
                                                    <Button
                                                        type="submit"
                                                        disabled={isSubmitting}
                                                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-2 px-4 sm:py-6 sm:px-8 text-sm sm:text-base"
                                                    >
                                                        {isSubmitting ? "Đang xử lý..." : "Tạo bài kiểm tra"}
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </form>
                                </TabsContent>

                                <TabsContent value="take">
                                    <div className="space-y-4 py-2 sm:py-4 max-w-4xl mx-auto">
                                        {activeQuiz ? (
                                            <div>
                                                {user.isCreator && (
                                                    <div className="flex justify-between items-center mb-3 sm:mb-6">
                                                        <div className="flex items-center">
                                                            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
                                                            <span className="text-xs sm:text-sm text-green-600 font-medium">Đang hoạt động</span>
                                                        </div>
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            className="text-xs sm:text-base py-1 px-3 sm:py-5 sm:px-6"
                                                            onClick={handleEndQuiz}
                                                            disabled={isSubmitting}
                                                        >
                                                            {isSubmitting ? "Đang xử lý..." : "Kết thúc bài kiểm tra"}
                                                        </Button>
                                                    </div>
                                                )}

                                                {isQuizInProgress ? (
                                                    <div className="bg-slate-50 p-3 sm:p-6 rounded-lg">
                                                        <QuizTakingView
                                                            roomId={roomId}
                                                            username={user.username}
                                                            quiz={activeQuiz}
                                                            onComplete={handleQuizComplete}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 sm:py-16 bg-slate-50 rounded-lg">
                                                        <h3 className="text-base sm:text-xl font-semibold mb-1 sm:mb-2">Bài kiểm tra: {activeQuiz.title}</h3>
                                                        <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">
                                                            Bài kiểm tra gồm {activeQuiz.questions.length} câu hỏi. Hãy chuẩn bị sẵn sàng.
                                                        </p>
                                                        {!user.isCreator && !quizResults && (
                                                            <Button
                                                                onClick={handleStartQuiz}
                                                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-2 px-4 sm:py-4 sm:px-6 text-sm sm:text-base"
                                                            >
                                                                Bắt đầu làm bài
                                                            </Button>
                                                        )}
                                                        {!user.isCreator && quizResults && (
                                                            <div className="mt-2 text-green-600 text-sm">
                                                                Bạn đã hoàn thành bài kiểm tra này.
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 sm:py-16 bg-slate-50 rounded-lg">
                                                <p className="text-gray-500 text-sm sm:text-lg">Chưa có bài kiểm tra nào được tạo</p>
                                                {user.isCreator && (
                                                    <Button
                                                        className="mt-4 sm:mt-6 py-2 px-4 sm:py-5 sm:px-6 text-xs sm:text-base"
                                                        onClick={() => setActiveTab('create')}
                                                    >
                                                        Tạo bài kiểm tra
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="results">
                                    <div className="space-y-4 py-2 sm:py-4 max-w-4xl mx-auto">
                                        {user.isCreator && allStudentResults.length > 0 ? (
                                            <div className="bg-slate-50 p-3 sm:p-6 rounded-lg">
                                                <div className="mb-4 sm:mb-6">
                                                    <Label htmlFor="student-select" className="text-sm sm:text-base mb-2 block focus:ring-1 focus:ring-blue-500">
                                                        Chọn học sinh
                                                    </Label>
                                                    <Select 
                                                        value={selectedStudentResult || ''}
                                                        onValueChange={handleStudentChange}
                                                    >
                                                        <SelectTrigger className="w-full focus:ring-1 focus:ring-blue-500">
                                                            <SelectValue placeholder="Chọn học sinh" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allStudentResults.map(student => (
                                                                <SelectItem key={student.participantId} value={student.participantId}>
                                                                    <div className="flex items-center">
                                                                        <User className="h-4 w-4 mr-2" />
                                                                        <span>{student.participantId}</span>
                                                                        <span className="ml-2 text-xs text-gray-500">
                                                                            ({student.results.score}/{student.results.totalPossibleScore})
                                                                        </span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                {quizResults && <QuizResultsView results={quizResults} />}
                                            </div>
                                        ) : quizResults ? (
                                            <div className="bg-slate-50 p-3 sm:p-6 rounded-lg">
                                                <QuizResultsView results={quizResults} />
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 sm:py-16 bg-slate-50 rounded-lg">
                                                <p className="text-gray-500 text-sm sm:text-lg">
                                                    {user.isCreator 
                                                        ? "Chưa có học sinh nào hoàn thành bài kiểm tra" 
                                                        : "Bạn chưa hoàn thành bài kiểm tra nào"}
                                                </p>
                                                {activeQuiz && !user.isCreator && (
                                                    <Button
                                                        className="mt-4 sm:mt-6 py-2 px-4 sm:py-5 sm:px-6 text-xs sm:text-base"
                                                        onClick={() => setActiveTab('take')}
                                                    >
                                                        Quay lại làm bài
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </>
    );
}; 