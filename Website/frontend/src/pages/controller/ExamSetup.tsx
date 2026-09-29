import { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  BookOpen, 
  Sparkles, 
  Layers, 
  SlidersHorizontal,
  Save
} from 'lucide-react';
import toast from 'react-hot-toast';

interface RubricPointDraft {
  id: string;
  criterion: string;
  points: number;
}

interface QuestionDraft {
  id: string;
  questionNumber: number;
  title: string;
  maxMarks: number;
  modelAnswer: string;
  rubric: RubricPointDraft[];
}

export default function ExamSetup() {
  const [examName, setExamName] = useState('Data Structures and Algorithm Design (CS-402)');
  const [subject, setSubject] = useState('Computer Science');
  const [examCode, setExamCode] = useState('CS-402');

  const [questions, setQuestions] = useState<QuestionDraft[]>([
    {
      id: 'q-1',
      questionNumber: 1,
      title: 'Analyze the amortized time complexity of dynamic array resizing.',
      maxMarks: 5,
      modelAnswer: 'Dynamic array resizing doubles capacity when full. An insertion costs O(1) normally and O(n) during resize. Across n operations, total copy cost is n/2 + n/4 + ... <= n, giving an amortized cost of O(1) per insert using aggregate analysis or accounting method.',
      rubric: [
        { id: 'r-1', criterion: 'Identifies geometric doubling factor 2', points: 2 },
        { id: 'r-2', criterion: 'Formulates summation of doubling costs <= n', points: 2 },
        { id: 'r-3', criterion: 'Concludes O(1) amortized bound correctly', points: 1 },
      ],
    },
    {
      id: 'q-2',
      questionNumber: 2,
      title: 'Explain Dijkstra’s algorithm and state its time complexity using a Fibonacci Heap.',
      maxMarks: 10,
      modelAnswer: 'Dijkstra finds shortest path in weighted graphs with non-negative edge weights using a greedy min-priority queue. With a Fibonacci Heap, insert and decrease-key take O(1) amortized, and extract-min takes O(log V) amortized, resulting in overall time O(E + V log V).',
      rubric: [
        { id: 'r-4', criterion: 'Underlying greedy relaxation principle stated', points: 3 },
        { id: 'r-5', criterion: 'Cost breakdown for Fibonacci heap operations', points: 4 },
        { id: 'r-6', criterion: 'Correct final time bound O(E + V log V)', points: 3 },
      ],
    },
  ]);

  const totalExamMarks = questions.reduce((sum, q) => sum + (q.maxMarks || 0), 0);

  const handleAddQuestion = () => {
    const nextNum = questions.length + 1;
    const newQ: QuestionDraft = {
      id: `q-${Date.now()}`,
      questionNumber: nextNum,
      title: '',
      maxMarks: 5,
      modelAnswer: '',
      rubric: [
        { id: `r-${Date.now()}-1`, criterion: 'Core conceptual clarity and definition', points: 2.5 },
        { id: `r-${Date.now()}-2`, criterion: 'Mathematical or architectural accuracy', points: 2.5 },
      ],
    };
    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) {
      toast.error('At least one question is required');
      return;
    }
    const updated = questions.filter((_, i) => i !== idx).map((q, i) => ({
      ...q,
      questionNumber: i + 1,
    }));
    setQuestions(updated);
  };

  const handleUpdateQuestion = (idx: number, field: keyof QuestionDraft, val: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleAddRubricPoint = (qIdx: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].rubric.push({
        id: `r-${Date.now()}`,
        criterion: '',
        points: 1,
      });
      return copy;
    });
  };

  const handleRemoveRubricPoint = (qIdx: number, rIdx: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].rubric = copy[qIdx].rubric.filter((_, i) => i !== rIdx);
      return copy;
    });
  };

  const handleUpdateRubricPoint = (qIdx: number, rIdx: number, field: keyof RubricPointDraft, val: any) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[qIdx].rubric[rIdx] = { ...copy[qIdx].rubric[rIdx], [field]: val };
      return copy;
    });
  };

  const handleSaveExamScheme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName.trim() || !subject.trim()) {
      toast.error('Please enter the examination title and subject');
      return;
    }
    toast.success(`Exam scheme "${examName}" configured with ${questions.length} questions (Total: ${totalExamMarks} Marks)!`, {
      icon: '📐',
      duration: 4000,
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 mb-2 border border-primary-200/50 dark:border-primary-800/40">
            <BookOpen size={12} className="text-primary-600 dark:text-primary-400" />
            <span>Marking Scheme Architect</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Examination & Rubric Setup
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure examination metadata, question-level model answers, and step-wise grading rubric weights.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-4 py-2 bg-slate-900 text-white rounded-xl shadow-md text-xs font-mono font-bold flex items-center space-x-2">
            <span>Total Marks:</span>
            <span className="text-primary-400 text-sm">{totalExamMarks}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveExamScheme} className="space-y-8">
        {/* Exam Metadata Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <SlidersHorizontal size={18} className="text-primary-600" />
            <span>General Examination Information</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Exam Title</label>
              <input
                type="text"
                required
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Exam / Course Code</label>
              <input
                type="text"
                required
                value={examCode}
                onChange={(e) => setExamCode(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-semibold focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Discipline / Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Question List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers size={20} className="text-primary-600" />
              <span>Questions & Rubric Schemes ({questions.length})</span>
            </h2>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="py-2 px-3.5 bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/60 dark:hover:bg-primary-900/60 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus size={15} />
              <span>Add Question</span>
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div
              key={q.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 relative"
            >
              {/* Question Header & Max Marks */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-lg bg-primary-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm">
                    Q{q.questionNumber}
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Question Definition
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span>Max Marks:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={q.maxMarks}
                      onChange={(e) => handleUpdateQuestion(qIdx, 'maxMarks', parseFloat(e.target.value) || 0)}
                      className="w-16 p-1 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-primary-600 outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveQuestion(qIdx)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    title="Delete Question"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Question Text
                </label>
                <textarea
                  rows={2}
                  required
                  value={q.title}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'title', e.target.value)}
                  placeholder="Enter full question statement..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Model Answer */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Sparkles size={12} className="text-indigo-500" />
                    <span>Official Model Answer / Solution Benchmark</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Used by AI OCR evaluation</span>
                </div>
                <textarea
                  rows={3}
                  required
                  value={q.modelAnswer}
                  onChange={(e) => handleUpdateQuestion(qIdx, 'modelAnswer', e.target.value)}
                  placeholder="Provide gold-standard reference solution for examiner and AI alignment..."
                  className="w-full p-2.5 text-xs bg-indigo-50/30 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Rubric Points Scheme */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Step-Wise Rubric Marking Criteria</span>
                  <button
                    type="button"
                    onClick={() => handleAddRubricPoint(qIdx)}
                    className="text-xs font-semibold text-primary-600 hover:text-primary-500 flex items-center space-x-1"
                  >
                    <Plus size={12} />
                    <span>Add Rubric Criterion</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {q.rubric.map((r, rIdx) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="text"
                        placeholder="Criterion description (e.g. Correct formula derivation)..."
                        value={r.criterion}
                        onChange={(e) => handleUpdateRubricPoint(qIdx, rIdx, 'criterion', e.target.value)}
                        className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <div className="flex items-center space-x-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max={q.maxMarks}
                          value={r.points}
                          onChange={(e) => handleUpdateRubricPoint(qIdx, rIdx, 'points', parseFloat(e.target.value) || 0)}
                          className="w-16 p-2 text-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-primary-600 outline-none"
                        />
                        <span className="text-slate-400">pts</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRubricPoint(qIdx, rIdx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Submit Scheme Button */}
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            className="py-3 px-6 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-sm font-bold shadow-md shadow-primary-500/20 flex items-center space-x-2 transition-all"
          >
            <Save size={18} />
            <span>Publish Examination Marking Scheme</span>
          </button>
        </div>
      </form>
    </div>
  );
}
