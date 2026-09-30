const { z } = require('zod');
const { SheetStatus } = require('../config/firestore');

/**
 * Upload sheet schema (without files, metadata only)
 */
const uploadSheetMetadataSchema = z.object({
  rollNo: z.string().min(1).max(50),
  studentName: z.string().min(1).max(200),
  examId: z.string().min(1).max(100)
}).strict();

/**
 * Status filter schema
 */
const statusFilterSchema = z.object({
  status: z.enum([
    SheetStatus.UPLOADED,
    SheetStatus.IN_PROGRESS,
    SheetStatus.EVALUATED,
    SheetStatus.FLAGGED,
    SheetStatus.VERIFIED
  ]).optional(),
  examId: z.string().optional()
}).strict();

/**
 * Save marks schema
 */
const saveMarksSchema = z.object({
  marks: z.number().min(0),
  comment: z.string().max(2000).optional(),
  timeSpentSec: z.number().int().min(0).optional()
}).strict();

/**
 * Question number parameter schema
 */
const qNoParamSchema = z.object({
  qNo: z.string().regex(/^\d+$/).transform(Number)
});

module.exports = {
  uploadSheetMetadataSchema,
  statusFilterSchema,
  saveMarksSchema,
  qNoParamSchema
};
