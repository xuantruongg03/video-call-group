import { z } from "zod";

export const quizSchema = z.object({
  title: z.string().min(1, "Tiêu đề bài kiểm tra không được để trống"),
  questions: z.array(
    z.object({
      text: z.string().min(1, "Nội dung câu hỏi không được để trống"),
      type: z.enum(["multiple-choice", "essay", "one-choice"]),
      options: z.array(
        z.object({
          text: z.string().min(1, "Nội dung tùy chọn không được để trống"),
          isCorrect: z.boolean(),
        })
      ).optional(),
      answer: z.string().optional(),
    })
  ).min(1, "Bài kiểm tra phải có ít nhất 1 câu hỏi"),
}); 