const { z } = require('zod');

/**
 * Rubric item schema
 */
const rubricItemSchema = z.object({
  criterion: z.string().min(1).max(500),
  points: z.number().min(0),
  description: z.string().max(1000).optional()
});

/**
 * Question schema
 */
const questionSchema = z.object({
  qNo: z.number().int().positive(),
  maxMarks: z.number().min(0).max(1000),
  text: z.string().min(1).max(5000),
  modelAnswer: z.string().max(10000).optional(),
  rubric: z.array(rubricItemSchema).optional().default([])
});

/**
 * Create exam schema
 */
const createExamSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().min(1).max(100),
  examDate: z.string().optional(), // ISO timestamp
  duration: z.number().int().positive().optional(), // minutes
  instructions: z.string().max(5000).optional(),
  questions: z.array(questionSchema).min(1).max(100)
}).strict();

module.exports = {
  createExamSchema,
  questionSchema,
  rubricItemSchema
};
