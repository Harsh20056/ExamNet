import jsPDF from 'jspdf';

export interface QuestionItem {
  id: number;
  text: string;
  options?: string[];
}

export interface ExamPaperDetails {
  title: string;
  subject: string;
  instructions?: string;
  totalMarks?: number;
  durationMinutes?: number;
  questions?: QuestionItem[];
  rawText?: string;
  imageDataUrl?: string;
}

export function compressImageDataUrl(dataUrl: string, maxWidth = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function generateQuestionPaperPDF(details: ExamPaperDetails): string {
  const doc = new jsPDF();
  
  // Header styling
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('SAMADHAN X - OFFICIAL EXAMINATION', 105, 16, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('AUTOMATIC PDF CONVERTED & REAL-TIME BROADCAST PAPER', 105, 25, { align: 'center' });

  // Sub-header details
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(`Subject: ${details.subject || 'Advanced Computer Science'}`, 14, 46);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Exam Title: ${details.title}`, 14, 54);
  doc.text(`Duration: 3 Hours (180 Mins)`, 140, 46);
  doc.text(`Total Marks: ${details.totalMarks || 100}`, 140, 54);

  // Line separator
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(14, 60, 196, 60);

  // Instructions
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUCTIONS TO CANDIDATES:', 14, 68);
  doc.setFont('helvetica', 'normal');
  const instructions = details.instructions || '1. All questions are compulsory.\n2. Do not exit full-screen or close camera window during 3-hour live countdown.\n3. Automatic proctoring monitoring is active throughout the exam session.';
  const splitInstr = doc.splitTextToSize(instructions, 180);
  doc.text(splitInstr, 14, 74);

  let currentY = 74 + (splitInstr.length * 5) + 4;
  
  doc.setDrawColor(203, 213, 225);
  doc.line(14, currentY, 196, currentY);
  currentY += 8;

  // Questions Section Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('QUESTION PAPER CONTENT', 14, currentY);
  currentY += 8;

  // 1. If an Image Photo of the Question Paper was uploaded, embed the photo directly into the PDF!
  if (details.imageDataUrl) {
    try {
      const isPng = details.imageDataUrl.includes('image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      
      // Calculate available height on page
      const availableWidth = 182;
      const imgHeight = 170;

      if (currentY + imgHeight > 280) {
        doc.addPage();
        currentY = 20;
      }

      doc.addImage(details.imageDataUrl, format, 14, currentY, availableWidth, imgHeight);
      currentY += imgHeight + 10;
    } catch (err) {
      console.error('Failed to embed image into PDF', err);
    }
  }

  // 2. Render structured questions if present
  if (details.questions && details.questions.length > 0) {
    details.questions.forEach((q, idx) => {
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const qTitle = `Q${idx + 1}. ${q.text}`;
      const splitQ = doc.splitTextToSize(qTitle, 180);
      doc.text(splitQ, 14, currentY);
      currentY += (splitQ.length * 5) + 2;

      if (q.options && q.options.length > 0) {
        doc.setFont('helvetica', 'normal');
        q.options.forEach((opt, optIdx) => {
          if (currentY > 270) {
            doc.addPage();
            currentY = 20;
          }
          const optLetter = String.fromCharCode(65 + optIdx);
          doc.text(`(${optLetter}) ${opt}`, 20, currentY);
          currentY += 5;
        });
      }
      currentY += 4;
    });
  } 
  
  // 3. Render raw text / OCR extracted text if present
  if (details.rawText) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const splitRaw = doc.splitTextToSize(details.rawText, 180);
    splitRaw.forEach((line: string) => {
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(line, 14, currentY);
      currentY += 5;
    });
  }

  // Footer / Watermark on bottom
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`SAMADHAN X Real-Time Broadcast Exam Paper • Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }

  return doc.output('datauristring');
}
