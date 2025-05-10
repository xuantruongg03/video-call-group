import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getQuizType(type: string) {
  if (type.toLowerCase() === 'trắc nghiệm nhiều đáp án'.toLowerCase()) return 'multiple-choice';
  if (type.toLowerCase() === 'tự luận'.toLowerCase()) return 'essay';
  if (type.toLowerCase() === 'trắc nghiệm 1 đáp án'.toLowerCase()) return 'one-choice';
  return 'unknown';
}

export function compareAnswer(answer: string, correctAnswer: string) {
  console.log(answer, correctAnswer);
  
  let a = answer.split(",");
  if (a.length === 1) {
    a = answer.toLowerCase().split(", ");
    if (a.length === 1) {
      return answer.toLowerCase().trim() === correctAnswer.toLowerCase();
    }
  }
  return a.map(item => item.trim()).find(item => item === correctAnswer.toLowerCase());
}
