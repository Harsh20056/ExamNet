const axios = require('axios');
const sharp = require('sharp');
const crypto = require('crypto');
const { z } = require('zod');
const { getFirestore, Collections } = require('../config/firestore');
const { getCurrentTimestamp } = require('../utils/timestamp');

/**
 * AI Response Schema for validation
 */
const aiResponseSchema = z.object({
  suggestedMarks: z.number().min(0),
  matched: z.array(z.string()),
  missed: z.array(z.string()),
  transcription: z.string(),
  confidence: z.number().min(0).max(1),
  reason: z.string()
}).strict();

/**
 * Calculate hash of image data for caching
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {string} SHA256 hash
 */
function calculateImageHash(imageBuffer) {
  return crypto.createHash('sha256').update(imageBuffer).digest('hex');
}

/**
 * Resize image for AI processing
 * @param {string} dataUrl - Base64 data URL
 * @param {number} maxWidth - Maximum width (default 1024)
 * @returns {Promise<Buffer>} Resized image buffer
 */
async function resizeImage(dataUrl, maxWidth = 1024) {
  // Extract base64 data from data URL
  const base64Data = dataUrl.split(',')[1];
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Resize image while maintaining aspect ratio
  const resized = await sharp(buffer)
    .resize(maxWidth, null, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  
  return resized;
}

/**
 * Build prompt for AI evaluation
 * @param {object} question - Question object
 * @param {string} transcription - OCR transcription (if available)
 * @returns {string} Prompt text
 */
function buildEvaluationPrompt(question, transcription = '') {
  const rubricText = question.rubric && question.rubric.length > 0
    ? question.rubric.map(r => `- ${r.criterion}: ${r.points} points - ${r.description || ''}`).join('\n')
    : 'No specific rubric provided.';
  
  return `You are an expert examiner evaluating a student's answer to an exam question.

**Question ${question.qNo} (Maximum Marks: ${question.maxMarks}):**
${question.text}

**Model Answer:**
${question.modelAnswer || 'Not provided'}

**Marking Rubric:**
${rubricText}

**Student's Answer (from image):**
${transcription || 'Please analyze the handwritten answer in the provided image.'}

**Task:**
Evaluate the student's answer and provide:
1. Suggested marks (0 to ${question.maxMarks})
2. List of rubric criteria matched
3. List of rubric criteria missed
4. Transcription of the handwritten answer (if not provided)
5. Confidence level (0.0 to 1.0)
6. Brief reason for the suggested marks

Respond ONLY with valid JSON in this exact format:
{
  "suggestedMarks": <number between 0 and ${question.maxMarks}>,
  "matched": ["criterion 1", "criterion 2"],
  "missed": ["criterion 3"],
  "transcription": "student's answer text",
  "confidence": <number between 0.0 and 1.0>,
  "reason": "brief explanation of marking decision"
}`;
}

/**
 * Call AI API for evaluation
 * @param {string} prompt - Evaluation prompt
 * @param {Buffer} imageBuffer - Resized image buffer
 * @returns {Promise<object>} AI response
 */
async function callAIAPI(prompt, imageBuffer) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  
  if (!apiKey) {
    throw new Error('AI_API_KEY not configured');
  }
  
  // Convert image to base64 for API
  const imageBase64 = imageBuffer.toString('base64');
  
  try {
    // OpenAI-compatible API call
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    const content = response.data.choices[0].message.content;
    return JSON.parse(content);
    
  } catch (error) {
    if (error.response) {
      console.error('[AI Service] API error:', error.response.status, error.response.data);
    } else {
      console.error('[AI Service] Request failed:', error.message);
    }
    throw error;
  }
}

/**
 * Get cached AI result
 * @param {string} sheetId - Sheet ID
 * @param {number} qNo - Question number
 * @param {string} imageHash - Image hash
 * @returns {Promise<object|null>} Cached result or null
 */
async function getCachedResult(sheetId, qNo, imageHash) {
  const db = getFirestore();
  
  const snapshot = await db.collection('aiCalls')
    .where('sheetId', '==', sheetId)
    .where('qNo', '==', qNo)
    .where('imageHash', '==', imageHash)
    .where('status', '==', 'success')
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data()
  };
}

/**
 * Load cached results from file (for demo/testing)
 * @returns {object} Cached results by sheetId and qNo
 */
function loadCachedResultsFile() {
  try {
    const cachedResults = require('../seed/cachedAIResults.json');
    return cachedResults;
  } catch (error) {
    console.warn('[AI Service] Cached results file not found, using empty cache');
    return {};
  }
}

/**
 * Get pre-generated result from cached file
 * @param {string} sheetId - Sheet ID
 * @param {number} qNo - Question number
 * @returns {object|null} Cached result or null
 */
function getPreGeneratedResult(sheetId, qNo) {
  const cached = loadCachedResultsFile();
  const directKey = `${sheetId}_q${qNo}`;
  if (cached[directKey]) return cached[directKey];

  // Try matching default templates like `default_q${qNo}` or `q${qNo}`
  if (cached[`default_q${qNo}`]) return cached[`default_q${qNo}`];
  if (cached[`q${qNo}`]) return cached[`q${qNo}`];

  // Try any key that ends with `_q${qNo}`
  const fallbackKey = Object.keys(cached).find(k => k.endsWith(`_q${qNo}`));
  if (fallbackKey && cached[fallbackKey]) {
    return cached[fallbackKey];
  }

  return null;
}

/**
 * Store AI call in Firestore
 * @param {object} callData - AI call data
 * @returns {Promise<string>} Document ID
 */
async function storeAICall(callData) {
  const db = getFirestore();
  
  const doc = {
    ...callData,
    createdAt: getCurrentTimestamp()
  };
  
  const docRef = await db.collection('aiCalls').add(doc);
  return docRef.id;
}

/**
 * Evaluate answer with AI
 * @param {string} sheetId - Sheet document ID
 * @param {number} qNo - Question number
 * @param {object} question - Question object
 * @param {string} pageDataUrl - Page image data URL
 * @param {string} userId - User ID requesting evaluation
 * @returns {Promise<object>} Evaluation result
 */
async function evaluateAnswer(sheetId, qNo, question, pageDataUrl, userId) {
  const startTime = Date.now();
  
  try {
    // Check if USE_CACHED_AI is enabled
    const useCachedAI = process.env.USE_CACHED_AI === 'true';
    
    if (useCachedAI) {
      console.log('[AI Service] Using cached results (USE_CACHED_AI=true)');
      const preGenerated = getPreGeneratedResult(sheetId, qNo);
      
      if (preGenerated) {
        // Store call record
        const callId = await storeAICall({
          sheetId,
          qNo,
          questionText: question.text,
          maxMarks: question.maxMarks,
          imageHash: 'cached',
          prompt: 'cached',
          response: preGenerated,
          status: 'success',
          source: 'cached_file',
          requestedBy: userId,
          processingTimeMs: 10
        });
        
        return {
          callId,
          ...preGenerated,
          source: 'cached_file'
        };
      } else {
        console.warn(`[AI Service] No cached result found for ${sheetId}_q${qNo}`);
      }
    }
    
    // Resize image
    const imageBuffer = await resizeImage(pageDataUrl);
    const imageHash = calculateImageHash(imageBuffer);
    
    // Check cache
    const cachedResult = await getCachedResult(sheetId, qNo, imageHash);
    if (cachedResult) {
      console.log('[AI Service] Using cached result from database');
      return {
        callId: cachedResult.id,
        ...cachedResult.response,
        source: 'cache'
      };
    }
    
    // Build prompt (anonymized - no student identity)
    const prompt = buildEvaluationPrompt(question);
    
    // Call AI API
    let aiResponse;
    let retryCount = 0;
    let validationError = null;
    
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        aiResponse = await callAIAPI(prompt, imageBuffer);
        
        // Validate response
        const validated = aiResponseSchema.parse(aiResponse);
        
        // Additional validation: suggestedMarks <= maxMarks
        if (validated.suggestedMarks > question.maxMarks) {
          validated.suggestedMarks = question.maxMarks;
        }
        
        aiResponse = validated;
        validationError = null;
        break;
        
      } catch (error) {
        retryCount = attempt + 1;
        validationError = error;
        
        if (attempt === 0) {
          console.warn('[AI Service] Invalid JSON on first attempt, retrying...', error.message);
        } else {
          console.error('[AI Service] Invalid JSON on retry, giving up');
          break;
        }
      }
    }
    
    // If validation failed after retries
    if (validationError) {
      const callId = await storeAICall({
        sheetId,
        qNo,
        questionText: question.text,
        maxMarks: question.maxMarks,
        imageHash,
        prompt,
        response: aiResponse || null,
        status: 'failed',
        error: validationError.message,
        requestedBy: userId,
        processingTimeMs: Date.now() - startTime,
        retryCount
      });
      
      return {
        callId,
        status: 'AI unavailable',
        error: 'Invalid response format',
        retryCount
      };
    }
    
    // Store successful call
    const callId = await storeAICall({
      sheetId,
      qNo,
      questionText: question.text,
      maxMarks: question.maxMarks,
      imageHash,
      prompt,
      response: aiResponse,
      status: 'success',
      requestedBy: userId,
      processingTimeMs: Date.now() - startTime,
      retryCount
    });
    
    return {
      callId,
      ...aiResponse,
      source: 'ai_api',
      processingTimeMs: Date.now() - startTime
    };
    
  } catch (error) {
    console.error('[AI Service] Evaluation failed:', error.message);
    
    // Store failed call
    const callId = await storeAICall({
      sheetId,
      qNo,
      questionText: question.text,
      maxMarks: question.maxMarks,
      imageHash: 'error',
      prompt: 'error',
      response: null,
      status: 'error',
      error: error.message,
      requestedBy: userId,
      processingTimeMs: Date.now() - startTime
    });
    
    return {
      callId,
      status: 'AI unavailable',
      error: error.message
    };
  }
}

/**
 * Store AI decision (accept/override)
 * @param {string} aiCallId - AI call document ID
 * @param {string} decision - 'accepted' or 'overridden'
 * @param {number|null} overrideMarks - Override marks (if overridden)
 * @param {string} note - Decision note
 * @param {string} userId - User making decision
 * @returns {Promise<object>} Updated call with decision
 */
async function storeAIDecision(aiCallId, decision, overrideMarks, note, userId) {
  const db = getFirestore();
  
  const aiCallDoc = await db.collection('aiCalls').doc(aiCallId).get();
  
  if (!aiCallDoc.exists) {
    throw new Error('AI call not found');
  }
  
  const aiCall = aiCallDoc.data();
  
  // Calculate final marks
  let finalMarks;
  if (decision === 'accepted') {
    finalMarks = aiCall.response.suggestedMarks;
  } else {
    finalMarks = overrideMarks;
  }
  
  // Update AI call with decision
  const updates = {
    decision: {
      type: decision,
      finalMarks,
      note,
      decidedBy: userId,
      decidedAt: getCurrentTimestamp()
    }
  };
  
  await db.collection('aiCalls').doc(aiCallId).update(updates);
  
  return {
    id: aiCallId,
    ...aiCall,
    ...updates
  };
}

module.exports = {
  evaluateAnswer,
  storeAIDecision,
  aiResponseSchema
};
