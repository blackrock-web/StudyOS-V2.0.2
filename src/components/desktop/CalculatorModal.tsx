import React, { useState } from 'react';
import { Calculator, X, Delete, RotateCcw } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState<string>('0');
  const [memory, setMemory] = useState<number>(0);

  if (!isOpen) return null;

  const handleNum = (num: string) => {
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOp = (op: string) => {
    setDisplay(display + ' ' + op + ' ');
  };

  const handleClear = () => setDisplay('0');

  const handleEvaluate = () => {
    try {
      // Clean display expression
      const expr = display.replace(/×/g, '*').replace(/÷/g, '/').replace(/ln/g, 'Math.log').replace(/log/g, 'Math.log10').replace(/sqrt/g, 'Math.sqrt');
      // safe eval for math expression
      const res = Function(`'use strict'; return (${expr})`)();
      setDisplay(String(Number(res.toFixed(6))));
    } catch {
      setDisplay('Error');
    }
  };

  const handleFunc = (fn: string) => {
    try {
      const val = parseFloat(display);
      if (isNaN(val)) return;
      if (fn === 'sin') setDisplay(String(Number(Math.sin(val).toFixed(6))));
      if (fn === 'cos') setDisplay(String(Number(Math.cos(val).toFixed(6))));
      if (fn === 'tan') setDisplay(String(Number(Math.tan(val).toFixed(6))));
      if (fn === 'ln') setDisplay(String(Number(Math.log(val).toFixed(6))));
      if (fn === 'log') setDisplay(String(Number(Math.log10(val).toFixed(6))));
      if (fn === 'sqrt') setDisplay(String(Number(Math.sqrt(val).toFixed(6))));
      if (fn === 'sq') setDisplay(String(Number(Math.pow(val, 2).toFixed(6))));
    } catch {
      setDisplay('Error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-purple-100 overflow-hidden">
        <div className="p-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold text-slate-900">GATE Scientific Calculator</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-purple-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="p-4 bg-slate-900 text-right">
          <div className="text-[10px] text-purple-400 font-mono mb-0.5">GATE 2027 Workspace</div>
          <div className="text-2xl font-mono font-bold text-white truncate">{display}</div>
        </div>

        {/* Scientific Functions */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-1.5 text-xs font-bold">
          <button onClick={() => handleFunc('sin')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">sin</button>
          <button onClick={() => handleFunc('cos')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">cos</button>
          <button onClick={() => handleFunc('tan')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">tan</button>
          <button onClick={() => handleFunc('sqrt')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">√x</button>
          <button onClick={() => handleFunc('ln')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">ln</button>
          <button onClick={() => handleFunc('log')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">log10</button>
          <button onClick={() => handleFunc('sq')} className="p-2 bg-white rounded-lg border border-slate-200 text-purple-700 hover:bg-purple-50">x²</button>
          <button onClick={handleClear} className="p-2 bg-rose-50 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-100 font-bold">AC</button>
        </div>

        {/* Numeric Numpad */}
        <div className="p-3 grid grid-cols-4 gap-1.5 text-sm font-bold text-slate-800">
          {['7', '8', '9', '÷'].map((item) => (
            <button
              key={item}
              onClick={() => (item === '÷' ? handleOp('/') : handleNum(item))}
              className={`p-3 rounded-xl border ${item === '÷' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              {item}
            </button>
          ))}
          {['4', '5', '6', '×'].map((item) => (
            <button
              key={item}
              onClick={() => (item === '×' ? handleOp('*') : handleNum(item))}
              className={`p-3 rounded-xl border ${item === '×' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              {item}
            </button>
          ))}
          {['1', '2', '3', '-'].map((item) => (
            <button
              key={item}
              onClick={() => (item === '-' ? handleOp('-') : handleNum(item))}
              className={`p-3 rounded-xl border ${item === '-' ? 'bg-purple-50 border-purple-200 text-purple-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
            >
              {item}
            </button>
          ))}
          {['0', '.', '=', '+'].map((item) => (
            <button
              key={item}
              onClick={() => {
                if (item === '=') handleEvaluate();
                else if (item === '+') handleOp('+');
                else handleNum(item);
              }}
              className={`p-3 rounded-xl border ${
                item === '='
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black shadow-md'
                  : item === '+'
                  ? 'bg-purple-50 border-purple-200 text-purple-700'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
