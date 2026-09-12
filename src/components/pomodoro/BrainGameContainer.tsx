import React, { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2,
  Trophy,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Award,
  Zap,
  Check,
  Flag,
  Bomb,
  HelpCircle,
  Brain,
  Hash,
  Grid,
  Layers,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { db } from '../../services/db';
import { audioService } from '../../services/audioService';

interface BrainGameContainerProps {
  defaultGame?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  muteSounds?: boolean;
  onClose?: () => void;
  isStandaloneModal?: boolean;
}

export const BrainGameContainer: React.FC<BrainGameContainerProps> = ({
  defaultGame = '2048',
  difficulty = 'medium',
  muteSounds = false,
  onClose,
  isStandaloneModal = false,
}) => {
  const [activeGame, setActiveGame] = useState<string>(defaultGame);
  const [muted, setMuted] = useState<boolean>(muteSounds);
  const [stats, setStats] = useState(() => db.getBreakGameStats());

  useEffect(() => {
    setActiveGame(defaultGame);
  }, [defaultGame]);

  const refreshStats = () => {
    setStats(db.getBreakGameStats());
  };

  const handleGameWon = (gameId: string, score: number, timeSecs: number) => {
    db.recordGameResult(gameId, score, true, timeSecs);
    refreshStats();
    if (!muted) {
      audioService.playVictoryFanfare();
    }
  };

  return (
    <div className="w-full bg-white/95 backdrop-blur-xl border border-purple-200 rounded-3xl p-4 sm:p-6 shadow-2xl flex flex-col space-y-5 text-slate-900">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md">
            <Gamepad2 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 border border-purple-200 px-2.5 py-0.5 rounded-full">
                100% Offline Brain Kiosk
              </span>
              <span className="text-xs text-slate-500 font-semibold">• Difficulty: {difficulty.toUpperCase()}</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
              Rest & Brain Games Kiosk
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-purple-50 border border-purple-100 text-xs font-bold text-purple-900">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Played: {stats.gamesPlayed}</span>
            <span>•</span>
            <span>Won: {stats.gamesWon}</span>
          </div>

          <button
            onClick={() => setMuted(!muted)}
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            title={muted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {muted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4 text-purple-600" />}
          </button>

          {isStandaloneModal && onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Game Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: '2048', label: '2048 Merge', icon: Grid },
          { id: 'sudoku', label: 'Sudoku Grid', icon: Hash },
          { id: 'memory', label: 'Memory Match', icon: Sparkles },
          { id: 'sliding', label: '15-Puzzle', icon: Layers },
          { id: 'minesweeper', label: 'Minesweeper', icon: Bomb },
          { id: 'speedMath', label: 'Speed Math', icon: Zap },
          { id: 'pattern', label: 'Pattern Recall', icon: Brain },
          { id: 'targetNumber', label: 'Target Number', icon: Award },
        ].map((g) => {
          const Icon = g.icon;
          const isActive = activeGame === g.id;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGame(g.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md scale-102'
                  : 'bg-slate-100 hover:bg-purple-50 text-slate-700 border border-slate-200/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{g.label}</span>
            </button>
          );
        })}
      </div>

      {/* Game View Container */}
      <div className="bg-slate-50/80 border border-purple-100 rounded-3xl p-4 sm:p-6 min-h-[360px] flex flex-col justify-center items-center relative overflow-hidden">
        {activeGame === '2048' && <Game2048 onWin={(score) => handleGameWon('2048', score, 60)} muted={muted} />}
        {activeGame === 'sudoku' && <SudokuGame onWin={() => handleGameWon('sudoku', 100, 120)} muted={muted} difficulty={difficulty} />}
        {activeGame === 'memory' && <MemoryMatchGame onWin={(moves) => handleGameWon('memory', Math.max(10, 200 - moves * 5), 45)} muted={muted} />}
        {activeGame === 'sliding' && <SlidingPuzzleGame onWin={(moves) => handleGameWon('sliding', Math.max(10, 300 - moves * 5), 60)} muted={muted} />}
        {activeGame === 'minesweeper' && <MinesweeperGame onWin={() => handleGameWon('minesweeper', 150, 90)} muted={muted} difficulty={difficulty} />}
        {activeGame === 'speedMath' && <SpeedMathGame onWin={(score) => handleGameWon('speedMath', score, 45)} muted={muted} />}
        {activeGame === 'pattern' && <PatternRecallGame onWin={(score) => handleGameWon('pattern', score, 30)} muted={muted} />}
        {activeGame === 'targetNumber' && <TargetNumberGame onWin={(score) => handleGameWon('targetNumber', score, 60)} muted={muted} />}
      </div>
    </div>
  );
};

// ==========================================
// 1. GAME 2048 COMPONENT
// ==========================================
const Game2048: React.FC<{ onWin: (score: number) => void; muted: boolean }> = ({ onWin }) => {
  const [board, setBoard] = useState<number[][]>(() => createInitial2048Board());
  const [score, setScore] = useState<number>(0);
  const [won, setWon] = useState<boolean>(false);

  function createInitial2048Board(): number[][] {
    const b = Array(4).fill(0).map(() => Array(4).fill(0));
    addRandomTile(b);
    addRandomTile(b);
    return b;
  }

  function addRandomTile(b: number[][]) {
    const emptyCells: [number, number][] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (b[r][c] === 0) emptyCells.push([r, c]);
      }
    }
    if (emptyCells.length > 0) {
      const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      b[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  }

  const moveBoard = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    let moved = false;
    let newScore = score;
    const newBoard = board.map((row) => [...row]);

    const rotateLeft = (b: number[][]) => {
      const res = Array(4).fill(0).map(() => Array(4).fill(0));
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          res[3 - c][r] = b[r][c];
        }
      }
      return res;
    };

    let temp = newBoard;
    let rotations = 0;
    if (direction === 'up') rotations = 1;
    if (direction === 'right') rotations = 2;
    if (direction === 'down') rotations = 3;

    for (let i = 0; i < rotations; i++) temp = rotateLeft(temp);

    // Slide left
    for (let r = 0; r < 4; r++) {
      const row = temp[r].filter((v) => v !== 0);
      for (let c = 0; c < row.length - 1; c++) {
        if (row[c] === row[c + 1]) {
          row[c] *= 2;
          newScore += row[c];
          row[c + 1] = 0;
          if (row[c] === 2048 && !won) {
            setWon(true);
            onWin(newScore);
          }
        }
      }
      const newRow = row.filter((v) => v !== 0);
      while (newRow.length < 4) newRow.push(0);

      for (let c = 0; c < 4; c++) {
        if (temp[r][c] !== newRow[c]) moved = true;
        temp[r][c] = newRow[c];
      }
    }

    // Rotate back
    for (let i = 0; i < (4 - rotations) % 4; i++) temp = rotateLeft(temp);

    if (moved) {
      addRandomTile(temp);
      setBoard(temp);
      setScore(newScore);
    }
  }, [board, score, won, onWin]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (e.key === 'ArrowUp') moveBoard('up');
        if (e.key === 'ArrowDown') moveBoard('down');
        if (e.key === 'ArrowLeft') moveBoard('left');
        if (e.key === 'ArrowRight') moveBoard('right');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveBoard]);

  const reset = () => {
    setBoard(createInitial2048Board());
    setScore(0);
    setWon(false);
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
      <div className="flex items-center justify-between w-full">
        <div className="bg-purple-100 text-purple-900 px-3 py-1.5 rounded-2xl text-xs font-black">
          Score: {score}
        </div>
        {won && <span className="text-xs font-extrabold text-emerald-600 animate-bounce">🎉 2048 Reached!</span>}
        <button
          onClick={reset}
          className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-800 p-3 rounded-2xl w-full aspect-square shadow-inner">
        {board.map((row, r) =>
          row.map((val, c) => (
            <div
              key={`${r}-${c}`}
              className={`flex items-center justify-center rounded-xl font-black text-sm sm:text-base transition-all ${
                val === 0
                  ? 'bg-slate-700/60'
                  : val === 2
                  ? 'bg-slate-100 text-slate-800'
                  : val === 4
                  ? 'bg-purple-100 text-purple-900'
                  : val === 8
                  ? 'bg-amber-400 text-white'
                  : val === 16
                  ? 'bg-orange-500 text-white'
                  : val === 32
                  ? 'bg-rose-500 text-white'
                  : 'bg-indigo-600 text-white shadow-md'
              }`}
            >
              {val > 0 ? val : ''}
            </div>
          ))
        )}
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-3 gap-2 w-32">
        <div />
        <button
          onClick={() => moveBoard('up')}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex justify-center cursor-pointer shadow-xs"
        >
          <ArrowUp className="w-4 h-4" />
        </button>
        <div />
        <button
          onClick={() => moveBoard('left')}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex justify-center cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => moveBoard('down')}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex justify-center cursor-pointer shadow-xs"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
        <button
          onClick={() => moveBoard('right')}
          className="p-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white flex justify-center cursor-pointer shadow-xs"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 2. SUDOKU GAME COMPONENT
// ==========================================
const SudokuGame: React.FC<{ onWin: () => void; muted: boolean; difficulty: string }> = ({ onWin }) => {
  const [grid, setGrid] = useState<number[][]>([
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
  ]);
  const [selected, setSelected] = useState<[number, number] | null>(null);

  const setNumber = (num: number) => {
    if (!selected) return;
    const [r, c] = selected;
    const newGrid = grid.map((row) => [...row]);
    newGrid[r][c] = num;
    setGrid(newGrid);

    // Check if grid completed
    let full = true;
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        if (newGrid[i][j] === 0) full = false;
      }
    }
    if (full) {
      onWin();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-sm">
      <div className="grid grid-cols-9 gap-0.5 bg-slate-400 p-1.5 rounded-2xl w-full aspect-square border-2 border-slate-700">
        {grid.map((row, r) =>
          row.map((val, c) => {
            const isSelected = selected && selected[0] === r && selected[1] === c;
            return (
              <button
                key={`${r}-${c}`}
                onClick={() => setSelected([r, c])}
                className={`flex items-center justify-center font-bold text-xs sm:text-sm aspect-square rounded-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-600 text-white font-black'
                    : val > 0
                    ? 'bg-white text-slate-900'
                    : 'bg-purple-50 hover:bg-purple-100 text-purple-700'
                } ${c % 3 === 2 && c < 8 ? 'border-r-2 border-slate-400' : ''} ${
                  r % 3 === 2 && r < 8 ? 'border-b-2 border-slate-400' : ''
                }`}
              >
                {val > 0 ? val : ''}
              </button>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 w-full">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            onClick={() => setNumber(n)}
            className="flex-1 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-900 font-extrabold text-xs transition-all cursor-pointer shadow-xs"
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => setNumber(0)}
          className="px-2 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 3. MEMORY MATCH CARDS
// ==========================================
const MemoryMatchGame: React.FC<{ onWin: (moves: number) => void; muted: boolean }> = ({ onWin }) => {
  const icons = ['🧠', '⚡', '🏆', '🎯', '🔥', '📚', '🛡️', '💎'];
  const [cards, setCards] = useState<{ id: number; icon: string; flipped: boolean; matched: boolean }[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);

  const initGame = useCallback(() => {
    const deck = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((icon, id) => ({ id, icon, flipped: false, matched: false }));
    setCards(deck);
    setFlippedIndices([]);
    setMoves(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleCardClick = (idx: number) => {
    if (flippedIndices.length === 2 || cards[idx].flipped || cards[idx].matched) return;

    const newCards = [...cards];
    newCards[idx].flipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, idx];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [first, second] = newFlipped;
      if (newCards[first].icon === newCards[second].icon) {
        newCards[first].matched = true;
        newCards[second].matched = true;
        setCards(newCards);
        setFlippedIndices([]);

        if (newCards.every((c) => c.matched)) {
          onWin(moves + 1);
        }
      } else {
        setTimeout(() => {
          newCards[first].flipped = false;
          newCards[second].flipped = false;
          setCards(newCards);
          setFlippedIndices([]);
        }, 800);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-xs">
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-slate-600">Moves: {moves}</span>
        <button
          onClick={initGame}
          className="p-1 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 transition-all cursor-pointer"
        >
          Reset Deck
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2.5 w-full aspect-square">
        {cards.map((c, idx) => (
          <button
            key={c.id}
            onClick={() => handleCardClick(idx)}
            className={`flex items-center justify-center rounded-2xl text-2xl font-black transition-all transform cursor-pointer border shadow-sm ${
              c.flipped || c.matched
                ? 'bg-white border-purple-300 rotate-0'
                : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-transparent border-purple-500'
            }`}
          >
            {c.flipped || c.matched ? c.icon : '❓'}
          </button>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 4. SLIDING 15-PUZZLE GAME
// ==========================================
const SlidingPuzzleGame: React.FC<{ onWin: (moves: number) => void; muted: boolean }> = ({ onWin }) => {
  const [board, setBoard] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);

  const initGame = useCallback(() => {
    const arr = Array.from({ length: 15 }, (_, i) => i + 1);
    arr.push(0);
    arr.sort(() => Math.random() - 0.5);
    setBoard(arr);
    setMoves(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const moveTile = (idx: number) => {
    const emptyIdx = board.indexOf(0);
    const r = Math.floor(idx / 4);
    const c = idx % 4;
    const er = Math.floor(emptyIdx / 4);
    const ec = emptyIdx % 4;

    if (Math.abs(r - er) + Math.abs(c - ec) === 1) {
      const newBoard = [...board];
      newBoard[emptyIdx] = board[idx];
      newBoard[idx] = 0;
      setBoard(newBoard);
      setMoves((m) => m + 1);

      // Check win
      const won = newBoard.slice(0, 15).every((val, i) => val === i + 1);
      if (won) onWin(moves + 1);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-xs">
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-slate-600">Moves: {moves}</span>
        <button
          onClick={initGame}
          className="p-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-300 cursor-pointer"
        >
          Shuffle
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 bg-slate-800 p-2.5 rounded-2xl w-full aspect-square">
        {board.map((num, idx) => (
          <button
            key={idx}
            onClick={() => moveTile(idx)}
            className={`flex items-center justify-center rounded-xl font-black text-sm transition-all cursor-pointer ${
              num === 0
                ? 'bg-slate-700/40 border border-slate-700'
                : 'bg-white hover:bg-purple-100 text-purple-950 shadow-sm border border-slate-200'
            }`}
          >
            {num > 0 ? num : ''}
          </button>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 5. MINESWEEPER GAME
// ==========================================
const MinesweeperGame: React.FC<{ onWin: () => void; muted: boolean; difficulty: string }> = ({ onWin }) => {
  const [board, setBoard] = useState<{ isMine: boolean; revealed: boolean; flagged: boolean; count: number }[][]>([]);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [won, setWon] = useState<boolean>(false);

  const initGame = useCallback(() => {
    const size = 8;
    const mineCount = 8;
    const b = Array(size)
      .fill(0)
      .map(() =>
        Array(size)
          .fill(0)
          .map(() => ({ isMine: false, revealed: false, flagged: false, count: 0 }))
      );

    let placed = 0;
    while (placed < mineCount) {
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      if (!b[r][c].isMine) {
        b[r][c].isMine = true;
        placed++;
      }
    }

    // Calc neighbor counts
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!b[r][c].isMine) {
          let mines = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (r + dr >= 0 && r + dr < size && c + dc >= 0 && c + dc < size) {
                if (b[r + dr][c + dc].isMine) mines++;
              }
            }
          }
          b[r][c].count = mines;
        }
      }
    }

    setBoard(b);
    setGameOver(false);
    setWon(false);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const revealCell = (r: number, c: number) => {
    if (gameOver || board[r][c].revealed || board[r][c].flagged) return;

    const newB = board.map((row) => row.map((cell) => ({ ...cell })));
    if (newB[r][c].isMine) {
      newB[r][c].revealed = true;
      setBoard(newB);
      setGameOver(true);
      return;
    }

    const revealNeighbors = (rr: number, cc: number) => {
      if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8 || newB[rr][cc].revealed || newB[rr][cc].flagged) return;
      newB[rr][cc].revealed = true;
      if (newB[rr][cc].count === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr !== 0 || dc !== 0) revealNeighbors(rr + dr, cc + dc);
          }
        }
      }
    };

    revealNeighbors(r, c);
    setBoard(newB);

    // Check win condition
    let unrevealedSafe = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (!newB[i][j].isMine && !newB[i][j].revealed) unrevealedSafe++;
      }
    }
    if (unrevealedSafe === 0) {
      setWon(true);
      setGameOver(true);
      onWin();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-3 w-full max-w-xs">
      <div className="flex items-center justify-between w-full">
        <span className="text-xs font-bold text-slate-700">
          {gameOver ? (won ? '🎉 Victory!' : '💥 Game Over') : '🚩 Minesweeper'}
        </span>
        <button onClick={initGame} className="px-2 py-1 rounded-xl bg-purple-600 text-white font-bold text-xs cursor-pointer">
          New Game
        </button>
      </div>

      <div className="grid grid-cols-8 gap-1 bg-slate-800 p-2 rounded-2xl w-full aspect-square">
        {board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${r}-${c}`}
              onClick={() => revealCell(r, c)}
              className={`flex items-center justify-center font-bold text-xs rounded-lg aspect-square cursor-pointer transition-all ${
                cell.revealed
                  ? cell.isMine
                    ? 'bg-rose-500 text-white'
                    : 'bg-white text-slate-900'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {cell.revealed ? (cell.isMine ? <Bomb className="w-3.5 h-3.5" /> : cell.count > 0 ? cell.count : '') : ''}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

// ==========================================
// 6. SPEED MATH GAME
// ==========================================
const SpeedMathGame: React.FC<{ onWin: (score: number) => void; muted: boolean }> = ({ onWin }) => {
  const [problem, setProblem] = useState<{ question: string; answer: number; options: number[] }>({
    question: '12 + 15',
    answer: 27,
    options: [27, 25, 30, 22],
  });
  const [score, setScore] = useState<number>(0);

  const generateProblem = useCallback(() => {
    const ops = ['+', '-', '*'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * 20) + 1;
    let b = Math.floor(Math.random() * 12) + 1;
    if (op === '-') if (a < b) [a, b] = [b, a];

    let ans = a + b;
    if (op === '-') ans = a - b;
    if (op === '*') ans = a * b;

    const opts = new Set<number>([ans]);
    while (opts.size < 4) {
      opts.add(ans + (Math.floor(Math.random() * 10) - 5));
    }

    setProblem({
      question: `${a} ${op} ${b}`,
      answer: ans,
      options: Array.from(opts).sort(() => Math.random() - 0.5),
    });
  }, []);

  const handleSelect = (opt: number) => {
    if (opt === problem.answer) {
      const nextScore = score + 10;
      setScore(nextScore);
      if (nextScore >= 50) {
        onWin(nextScore);
      } else {
        generateProblem();
      }
    } else {
      setScore(Math.max(0, score - 5));
      generateProblem();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-xs text-center">
      <div className="text-xs font-bold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">Score: {score} / 50</div>
      <div className="text-3xl font-black text-slate-900 font-mono tracking-wider bg-white px-6 py-4 rounded-2xl border border-purple-200 shadow-sm w-full">
        {problem.question} = ?
      </div>
      <div className="grid grid-cols-2 gap-3 w-full">
        {problem.options.map((opt, i) => (
          <button
            key={i}
            onClick={() => handleSelect(opt)}
            className="py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-black text-base shadow-sm transition-all cursor-pointer"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// 7. PATTERN RECALL GAME
// ==========================================
const PatternRecallGame: React.FC<{ onWin: (score: number) => void; muted: boolean }> = ({ onWin }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSeq, setUserSeq] = useState<number[]>([]);
  const [activeSquare, setActiveSquare] = useState<number | null>(null);
  const [isPlayingSeq, setIsPlayingSeq] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);

  const addStep = useCallback(() => {
    const nextSquare = Math.floor(Math.random() * 4);
    const nextSeq = [...sequence, nextSquare];
    setSequence(nextSeq);
    setUserSeq([]);
    playSeq(nextSeq);
  }, [sequence]);

  const playSeq = (seq: number[]) => {
    setIsPlayingSeq(true);
    seq.forEach((sq, i) => {
      setTimeout(() => {
        setActiveSquare(sq);
        setTimeout(() => setActiveSquare(null), 400);
        if (i === seq.length - 1) setIsPlayingSeq(false);
      }, (i + 1) * 600);
    });
  };

  const handleClick = (idx: number) => {
    if (isPlayingSeq) return;
    const nextUser = [...userSeq, idx];
    setUserSeq(nextUser);

    if (idx !== sequence[nextUser.length - 1]) {
      // Failed
      setSequence([]);
      setUserSeq([]);
      setScore(0);
      return;
    }

    if (nextUser.length === sequence.length) {
      const newScore = score + 10;
      setScore(newScore);
      if (newScore >= 40) {
        onWin(newScore);
      } else {
        setTimeout(addStep, 800);
      }
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
      <div className="text-xs font-bold text-purple-900 bg-purple-100 px-3 py-1 rounded-full">
        Pattern Level: {sequence.length} (Score: {score})
      </div>
      <div className="grid grid-cols-2 gap-3 w-full aspect-square">
        {[0, 1, 2, 3].map((sq) => (
          <button
            key={sq}
            onClick={() => handleClick(sq)}
            className={`rounded-3xl transition-all cursor-pointer border-2 ${
              activeSquare === sq
                ? 'bg-amber-400 border-amber-500 scale-105 shadow-lg'
                : sq === 0
                ? 'bg-purple-600 border-purple-700'
                : sq === 1
                ? 'bg-indigo-600 border-indigo-700'
                : sq === 2
                ? 'bg-emerald-600 border-emerald-700'
                : 'bg-rose-600 border-rose-700'
            }`}
          />
        ))}
      </div>
      {sequence.length === 0 && (
        <button
          onClick={addStep}
          className="px-6 py-2.5 rounded-2xl bg-purple-600 text-white font-extrabold text-xs shadow-md cursor-pointer hover:bg-purple-700"
        >
          Start Recall Game
        </button>
      )}
    </div>
  );
};

// ==========================================
// 8. TARGET NUMBER PUZZLE
// ==========================================
const TargetNumberGame: React.FC<{ onWin: (score: number) => void; muted: boolean }> = ({ onWin }) => {
  const [target] = useState<number>(24);
  const [numbers] = useState<number[]>([3, 8, 2, 1]);
  const [currentVal, setCurrentVal] = useState<number | null>(null);

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-xs text-center">
      <div className="p-3 rounded-2xl bg-purple-100 border border-purple-200 text-purple-950 w-full">
        <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Target Number</div>
        <div className="text-4xl font-black font-mono mt-0.5">{target}</div>
      </div>

      <div className="text-xs text-slate-600">Combine numbers using +, -, * to equal {target}!</div>

      <div className="flex items-center justify-center gap-2">
        {numbers.map((num, i) => (
          <button
            key={i}
            onClick={() => {
              if (currentVal === null) setCurrentVal(num);
              else setCurrentVal(currentVal + num);
              if (currentVal && currentVal + num === target) onWin(100);
            }}
            className="w-12 h-12 rounded-2xl bg-white border border-purple-300 font-black text-lg text-purple-900 shadow-sm hover:bg-purple-50 cursor-pointer"
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
};
