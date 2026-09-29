import { type ReactNode, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowUpRight, Brain, CalendarCheck, CalendarDays, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Coffee, Flame, ListChecks, ListTodo, Menu,
  Pause, Play, Plus, RotateCcw, Send, Settings2, Sparkles,
  StickyNote, Sun, Timer, Trash2, X, Zap,
} from 'lucide-react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

type Priority = 'Low' | 'Medium' | 'High';
type Task = { id: string; title: string; priority: Priority; completed: boolean; createdAt: string; completedAt?: string };
type Habit = { id: string; name: string; completedDates: string[]; createdAt: string };
type Note = { title: string; content: string; updatedAt: string };
type AppState = { tasks: Task[]; habits: Habit[]; note: Note; focusMinutes: number; focusDate: string };
type ChatMessage = { role: 'assistant' | 'user'; content: string };

const queryClient = new QueryClient();
const STORAGE_KEY = 'lumina-ai-state-v1';
const USER_TIME_ZONE = 'Asia/Kolkata';
const getZonedParts = (date = new Date()) =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: USER_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  ) as Record<string, string>;
const todayKey = () => {
  const { year, month, day } = getZonedParts();
  return `${year}-${month}-${day}`;
};
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emptyState = (): AppState => ({
  tasks: [], habits: [], note: { title: '', content: '', updatedAt: new Date().toISOString() },
  focusMinutes: 0, focusDate: todayKey(),
});
const loadState = (): AppState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '');
    if (!parsed || !Array.isArray(parsed.tasks)) return emptyState();
    return { ...emptyState(), ...parsed, note: { ...emptyState().note, ...parsed.note } };
  } catch { return emptyState(); }
};
const formatDate = (date = new Date()) => date.toLocaleDateString(undefined, { timeZone: USER_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const greeting = () => { const h = Number(getZonedParts().hour); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : h < 22 ? 'Good evening' : 'Good night'; };
const getStreak = (dates: string[]) => {
  const set = new Set(dates);
  const [year, month, day] = todayKey().split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day, 12));
  let streak = 0;
  while (set.has(cursor.toISOString().slice(0, 10))) { streak += 1; cursor.setUTCDate(cursor.getUTCDate() - 1); }
  return streak;
};

const navItems = [
  { path: '/', label: 'Dashboard', icon: <CalendarCheck size={18} /> },
  { path: '/tasks', label: 'Tasks', icon: <ListTodo size={18} /> },
  { path: '/habits', label: 'Habits', icon: <Flame size={18} /> },
  { path: '/focus', label: 'Focus', icon: <Timer size={18} /> },
  { path: '/notes', label: 'Notes', icon: <StickyNote size={18} /> },
];

function LuminaAvatar({ size = 64, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`lumina-avatar ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label="Lumina AI avatar"
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="60" fill="hsl(var(--accent))" />
        <path d="M24 103c6-20 21-31 36-31s30 11 36 31" fill="hsl(var(--sidebar))" />
        <path d="M31 56c0-28 12-42 29-42 20 0 31 16 29 43-7-7-12-17-15-28-10 10-24 17-43 17v10Z" fill="hsl(var(--sidebar))" />
        <path d="M38 57c0-13 9-23 22-23s22 10 22 23v12c0 13-9 23-22 23S38 82 38 69V57Z" fill="hsl(var(--card))" />
        <path d="M37 56c5-19 14-25 27-25 10 0 17 5 22 14-12 4-25 5-39 2-2 4-5 7-10 9Z" fill="hsl(var(--sidebar))" />
        <circle cx="51" cy="62" r="2.5" fill="hsl(var(--foreground))" />
        <circle cx="69" cy="62" r="2.5" fill="hsl(var(--foreground))" />
        <path d="M57 72c2 2 4 2 6 0" fill="none" stroke="hsl(var(--primary))" strokeLinecap="round" strokeWidth="2.5" />
        <path d="M39 53c4-4 8-5 13-4M68 49c5-1 9 0 13 4" fill="none" stroke="hsl(var(--sidebar))" strokeLinecap="round" strokeWidth="2.5" />
        <circle cx="90" cy="24" r="10" fill="hsl(var(--card))" opacity=".95" />
        <path d="m90 18 1.6 4.4L96 24l-4.4 1.6L90 30l-1.6-4.4L84 24l4.4-1.6L90 18Z" fill="hsl(var(--primary))" />
      </svg>
    </span>
  );
}

function AppShell() {
  const [location, setLocation] = useLocation();
  const [state, setState] = useState<AppState>(loadState);
  const [chatOpen, setChatOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'I’m here. What would make today feel a little lighter?' },
  ]);
  const [focusRequest, setFocusRequest] = useState(0);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);
  useEffect(() => {
    if (state.focusDate !== todayKey()) setState(prev => ({ ...prev, focusDate: todayKey(), focusMinutes: 0 }));
  }, [state.focusDate]);

  const updateState = (patch: Partial<AppState>) => setState(prev => ({ ...prev, ...patch }));
  const addTask = (title: string, priority: Priority = 'Medium') => {
    if (!title.trim()) return;
    const task: Task = { id: makeId(), title: title.trim(), priority, completed: false, createdAt: new Date().toISOString() };
    setState(prev => ({ ...prev, tasks: [task, ...prev.tasks] }));
  };
  const toggleTask = (id: string) => setState(prev => ({
    ...prev, tasks: prev.tasks.map(task => task.id === id ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : undefined } : task),
  }));
  const deleteTask = (id: string) => setState(prev => ({ ...prev, tasks: prev.tasks.filter(task => task.id !== id) }));
  const addHabit = (name: string) => {
    if (!name.trim()) return;
    setState(prev => ({ ...prev, habits: [{ id: makeId(), name: name.trim(), completedDates: [], createdAt: new Date().toISOString() }, ...prev.habits] }));
  };
  const toggleHabit = (id: string) => {
    const day = todayKey();
    setState(prev => ({ ...prev, habits: prev.habits.map(habit => habit.id === id ? { ...habit, completedDates: habit.completedDates.includes(day) ? habit.completedDates.filter(d => d !== day) : [...habit.completedDates, day] } : habit) }));
  };
  const deleteHabit = (id: string) => setState(prev => ({ ...prev, habits: prev.habits.filter(habit => habit.id !== id) }));
  const replyToChat = (text: string) => {
    const q = text.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    let response = '';
    if ((lower.includes('add') || lower.includes('create')) && lower.includes('task')) {
      const title = q.replace(/^(please\s+)?(add|create)\s+(a\s+)?task\s*/i, '').replace(/^to\s+/i, '').trim();
      if (title) { addTask(title); response = `Added “${title}” to your tasks.`; }
      else response = 'What should I add to your task list?';
    } else if (lower.includes('today') && lower.includes('task')) {
      const active = state.tasks.filter(task => !task.completed);
      response = active.length ? `You have ${active.length} task${active.length === 1 ? '' : 's'} open today: ${active.slice(0, 3).map(task => task.title).join(', ')}${active.length > 3 ? ', and a few more.' : '.'}` : 'Your task list is clear. A quiet little victory.';
    } else if (lower.includes('progress') || lower.includes('how am i doing')) {
      const total = state.tasks.length + state.habits.length;
      const done = state.tasks.filter(task => task.completed).length + state.habits.filter(habit => habit.completedDates.includes(todayKey())).length;
      response = total ? `You’re at ${Math.round((done / total) * 100)}% for the day, with ${state.focusMinutes} focus minutes logged.` : 'Your day is still a blank page. Add one small thing to begin.';
    } else if (lower.includes('start') && lower.includes('focus')) {
      setFocusRequest(v => v + 1); setLocation('/focus'); response = 'Focus mode is ready. Twenty-five minutes, just one thing.';
    } else if (lower.includes('habit')) {
      response = state.habits.length ? `You’re tending ${state.habits.length} habit${state.habits.length === 1 ? '' : 's'}. ${state.habits.filter(h => h.completedDates.includes(todayKey())).length} checked in today.` : 'No habits yet. A tiny repeatable ritual is a good place to start.';
    } else if (lower.includes('finish') || lower.includes('complete')) {
      const open = state.tasks.find(task => !task.completed && lower.includes(task.title.toLowerCase()));
      if (open) { toggleTask(open.id); response = `Nice work. Marked “${open.title}” complete.`; }
      else response = 'Tell me the task name and I’ll mark it complete.';
    } else if (lower.includes('motivat') || lower.includes('encourage')) {
      response = 'You do not need a perfect day. Pick the next kind, clear step.';
    } else {
      response = 'I can add tasks, show today’s tasks, check progress, start focus, talk through habits, finish a task, or offer a little motivation.';
    }
    setChatMessages(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: response }]);
  };
  const completeFocus = (minutes: number) => updateState({ focusMinutes: state.focusMinutes + minutes });

  return (
    <div className="lumina-shell flex text-foreground">
      <div className="lumina-grain" aria-hidden="true" />
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 w-[246px] flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-7 pt-8 pb-10">
          <button data-testid="button-brand-home" onClick={() => setLocation('/')} className="flex items-center gap-3 text-left">
            <span className="grid size-10 place-items-center rounded-2xl bg-accent text-sidebar-primary-foreground shadow-lg shadow-accent/20"><Sparkles size={20} /></span>
            <span><span className="block font-serif text-2xl leading-none tracking-tight">lumina</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[.28em] text-sidebar-foreground/55">a quieter way forward</span></span>
          </button>
        </div>
        <nav className="flex-1 space-y-1 px-4" aria-label="Primary navigation">
          {navItems.map(item => <button key={item.path} data-testid={`nav-${item.label.toLowerCase()}`} onClick={() => { setLocation(item.path); setMobileMenu(false); }} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm transition ${location === item.path ? 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}>{item.icon}<span>{item.label}</span>{location === item.path && <ChevronRight className="ml-auto" size={15} />}</button>)}
        </nav>
        <div className="p-4">
          <button data-testid="nav-settings" onClick={() => setLocation('/settings')} className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm transition ${location === '/settings' ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Settings2 size={18} />Settings</button>
          <div className="mt-5 rounded-2xl border border-sidebar-border bg-sidebar-accent/40 p-4">
            <div className="mb-2 flex items-center gap-2 text-accent"><Sun size={15} /><span className="font-mono text-[10px] uppercase tracking-widest">Today’s note</span></div>
            <p className="text-xs leading-relaxed text-sidebar-foreground/65">Small steps still count as movement.</p>
          </div>
        </div>
      </aside>
      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col md:ml-[246px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/70 bg-background/80 px-5 backdrop-blur-xl md:px-10">
          <div className="flex items-center gap-3">
            <button data-testid="button-mobile-menu" onClick={() => setMobileMenu(v => !v)} className="grid size-10 place-items-center rounded-xl bg-card md:hidden"><Menu size={20} /></button>
            <div className="md:hidden"><span className="font-serif text-xl">lumina</span></div>
            <div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex"><span className="size-2 rounded-full bg-accent" />Your personal daily space</div>
          </div>
          <button data-testid="button-open-chat-header" onClick={() => setChatOpen(true)} className="flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium shadow-sm transition hover:border-primary/50"><LuminaAvatar size={26} /><span className="hidden sm:inline">Ask Lumina</span><span className="text-muted-foreground">⌘K</span></button>
        </header>
        {mobileMenu && <div className="fixed inset-x-0 top-[72px] z-30 border-b border-border bg-sidebar p-3 text-sidebar-foreground md:hidden">{navItems.map(item => <button key={item.path} data-testid={`mobile-nav-${item.label.toLowerCase()}`} onClick={() => { setLocation(item.path); setMobileMenu(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm">{item.icon}{item.label}</button>)}<button data-testid="mobile-nav-settings" onClick={() => { setLocation('/settings'); setMobileMenu(false); }} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-sm"><Settings2 size={18} />Settings</button></div>}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-8 md:px-10 md:py-11">
          <Switch>
            <Route path="/" component={() => <Dashboard state={state} setLocation={setLocation} toggleTask={toggleTask} onOpenChat={() => setChatOpen(true)} />} />
            <Route path="/tasks" component={() => <TasksPage tasks={state.tasks} addTask={addTask} toggleTask={toggleTask} deleteTask={deleteTask} />} />
            <Route path="/habits" component={() => <HabitsPage habits={state.habits} addHabit={addHabit} toggleHabit={toggleHabit} deleteHabit={deleteHabit} />} />
            <Route path="/focus" component={() => <FocusPage focusMinutes={state.focusMinutes} onComplete={completeFocus} request={focusRequest} />} />
            <Route path="/notes" component={() => <NotesPage note={state.note} updateNote={note => updateState({ note })} />} />
            <Route path="/settings" component={() => <SettingsPage onReset={() => setState(emptyState())} />} />
            <Route component={() => <Dashboard state={state} setLocation={setLocation} toggleTask={toggleTask} onOpenChat={() => setChatOpen(true)} />} />
          </Switch>
        </main>
      </div>
      <ChatPanel open={chatOpen} messages={chatMessages} onClose={() => setChatOpen(false)} onSend={replyToChat} />
      {!chatOpen && <button data-testid="button-open-chat" onClick={() => setChatOpen(true)} className="fixed bottom-5 right-5 z-40 grid size-14 place-items-center rounded-2xl bg-sidebar p-1.5 shadow-xl shadow-sidebar/20 transition hover:-translate-y-1 md:bottom-8 md:right-8" aria-label="Open Lumina chat"><LuminaAvatar size={44} className="lumina-avatar-float" /></button>}
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.24em] text-primary"><span className="size-1.5 rounded-full bg-accent" />{eyebrow}</div><h1 className="font-serif text-4xl tracking-tight md:text-5xl">{title}</h1><p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p></div>{action}</div>;
}

function Dashboard({ state, setLocation, toggleTask, onOpenChat }: { state: AppState; setLocation: (path: string) => void; toggleTask: (id: string) => void; onOpenChat: () => void }) {
  const total = state.tasks.length + state.habits.length;
  const done = state.tasks.filter(t => t.completed).length + state.habits.filter(h => h.completedDates.includes(todayKey())).length;
  const progress = total ? Math.round(done / total * 100) : 0;
  const activeTasks = state.tasks.filter(t => !t.completed).slice(0, 4);
  return <div className="lumina-appear">
    <PageHeading eyebrow={formatDate()} title={`${greeting()}, friend.`} description="A clear place to begin. What deserves your attention today?" action={<button data-testid="button-dashboard-add-task" onClick={() => setLocation('/tasks')} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5"><Plus size={17} />Add a task</button>} />
    <section className="mb-5 overflow-hidden rounded-[1.5rem] bg-sidebar text-sidebar-foreground shadow-lg shadow-sidebar/10">
      <div className="relative flex flex-col items-start gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="absolute -right-12 -top-16 size-40 rounded-full bg-accent/10 blur-3xl" />
        <LuminaAvatar size={86} className="relative shrink-0 shadow-xl shadow-black/20" />
        <div className="relative min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[.22em] text-accent">Meet Lumina</p>
          <h2 className="mt-1 font-serif text-2xl">Your personal AI companion.</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-sidebar-foreground/65">I can help you plan the day, keep your habits close, and find your next clear step.</p>
        </div>
        <button data-testid="button-dashboard-ask-lumina" onClick={onOpenChat} className="relative flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:-translate-y-0.5">Talk to Lumina <ArrowUpRight size={16} /></button>
      </div>
    </section>
    <section className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
      <div className="lumina-card relative overflow-hidden rounded-[1.5rem] p-6 md:p-8">
        <div className="absolute right-[-80px] top-[-100px] size-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Daily rhythm</p><h2 className="mt-3 max-w-md font-serif text-3xl leading-tight md:text-4xl">Make space for what matters.</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">Progress is not a performance. It is simply noticing what you did.</p><button data-testid="button-dashboard-focus" onClick={() => setLocation('/focus')} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">Begin a focus session <ArrowUpRight size={16} /></button></div>
          <div className="relative grid size-40 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${progress}%, hsl(var(--muted)) 0)` }}><div className="grid size-[124px] place-items-center rounded-full bg-card"><div className="text-center"><span data-testid="text-daily-progress" className="block font-serif text-3xl">{progress}%</span><span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">complete</span></div></div></div>
        </div>
      </div>
      <div className="lumina-card rounded-[1.5rem] bg-sidebar p-6 text-sidebar-foreground">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-accent"><Clock3 size={17} /><span className="font-mono text-[10px] uppercase tracking-[.2em]">Focus today</span></div><button data-testid="button-dashboard-open-focus" onClick={() => setLocation('/focus')} className="text-sidebar-foreground/50 transition hover:text-accent"><ChevronRight size={18} /></button></div>
        <div className="mt-7 flex items-end gap-2"><span data-testid="text-focus-minutes" className="font-serif text-5xl">{state.focusMinutes}</span><span className="mb-2 text-sm text-sidebar-foreground/55">minutes</span></div><div className="mt-5 h-1.5 overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(state.focusMinutes / 100 * 100, 100)}%` }} /></div><p className="mt-3 text-xs text-sidebar-foreground/55">A little focus goes a long way.</p>
      </div>
    </section>
    <section className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
      <div className="lumina-card rounded-[1.5rem] p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">On your plate</p><h2 className="mt-1 text-lg font-semibold">Today’s tasks</h2></div><button data-testid="button-dashboard-view-tasks" onClick={() => setLocation('/tasks')} className="flex items-center gap-1 text-xs font-semibold text-primary">View all <ChevronRight size={14} /></button></div>{activeTasks.length ? <div className="space-y-2">{activeTasks.map(task => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id)} compact />)}</div> : <EmptyState icon={<ListChecks size={21} />} title="A clean slate" text="Add one small, specific task to get moving." action={<button data-testid="button-empty-add-task" onClick={() => setLocation('/tasks')} className="text-sm font-semibold text-primary hover:underline">Add your first task</button>} />}</div>
      <div className="lumina-card rounded-[1.5rem] p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Small rituals</p><h2 className="mt-1 text-lg font-semibold">Habits</h2></div><button data-testid="button-dashboard-view-habits" onClick={() => setLocation('/habits')} className="text-primary"><ChevronRight size={18} /></button></div>{state.habits.length ? <div className="space-y-3">{state.habits.slice(0, 3).map(habit => <div key={habit.id} className="flex items-center gap-3"><div className={`grid size-8 place-items-center rounded-lg ${habit.completedDates.includes(todayKey()) ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>{habit.completedDates.includes(todayKey()) ? <Check size={15} /> : <Sun size={15} />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{habit.name}</p><p className="font-mono text-[10px] text-muted-foreground">{getStreak(habit.completedDates)} day streak</p></div></div>)}</div> : <EmptyState icon={<Sun size={21} />} title="Build a gentle rhythm" text="Habits work best when they are small enough to keep." action={<button data-testid="button-empty-add-habit" onClick={() => setLocation('/habits')} className="text-sm font-semibold text-primary hover:underline">Create a habit</button>} />}</div>
    </section>
  </div>;
}

function TaskRow({ task, onToggle, onDelete, compact = false }: { task: Task; onToggle: () => void; onDelete?: () => void; compact?: boolean }) {
  return <div className={`group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-border hover:bg-muted/45 ${task.completed ? 'opacity-60' : ''}`}><button data-testid={`button-complete-task-${task.id}`} onClick={onToggle} className={`grid size-6 shrink-0 place-items-center rounded-full border-2 transition ${task.completed ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary'}`} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.completed && <Check size={13} strokeWidth={3} />}</button><div className="min-w-0 flex-1"><p className={`truncate text-sm ${task.completed ? 'line-through' : 'font-medium'}`}>{task.title}</p>{!compact && <p className="mt-1 text-xs text-muted-foreground">{new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p>}</div><span className={`rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wider ${task.priority === 'High' ? 'bg-destructive/10 text-destructive' : task.priority === 'Low' ? 'bg-muted text-muted-foreground' : 'bg-accent/25 text-primary'}`}>{task.priority}</span>{onDelete && <button data-testid={`button-delete-task-${task.id}`} onClick={onDelete} className="ml-1 hidden rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block" aria-label={`Delete ${task.title}`}><Trash2 size={15} /></button>}</div>;
}

function TasksPage({ tasks, addTask, toggleTask, deleteTask }: { tasks: Task[]; addTask: (title: string, priority?: Priority) => void; toggleTask: (id: string) => void; deleteTask: (id: string) => void }) {
  const [title, setTitle] = useState(''); const [priority, setPriority] = useState<Priority>('Medium'); const [view, setView] = useState<'active' | 'completed'>('active');
  const shown = tasks.filter(task => view === 'active' ? !task.completed : task.completed);
  const submit = () => { addTask(title, priority); setTitle(''); };
  return <div className="lumina-appear"><PageHeading eyebrow="Your list" title="Tasks" description="Keep the next step visible. Everything else can wait its turn." /><section className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><div className="lumina-card h-fit rounded-[1.5rem] p-6"><div className="mb-5 flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-accent/30 text-primary"><Plus size={17} /></span><h2 className="font-semibold">Add something</h2></div><label className="mb-2 block text-xs font-semibold text-muted-foreground" htmlFor="task-title">What needs doing?</label><input data-testid="input-task-title" id="task-title" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. Send the project outline" className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none transition focus:border-primary" /><div className="mt-4 flex gap-2">{(['Low', 'Medium', 'High'] as Priority[]).map(level => <button key={level} data-testid={`button-priority-${level.toLowerCase()}`} onClick={() => setPriority(level)} className={`min-h-10 flex-1 rounded-lg border text-xs font-semibold transition ${priority === level ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary'}`}>{level}</button>)}</div><button data-testid="button-add-task" disabled={!title.trim()} onClick={submit} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"><Plus size={17} />Add task</button></div><div className="lumina-card rounded-[1.5rem] p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Your queue</p><h2 className="mt-1 text-lg font-semibold">{shown.length} {view} {shown.length === 1 ? 'task' : 'tasks'}</h2></div><div className="flex rounded-lg bg-muted p-1"><button data-testid="button-active-tasks" onClick={() => setView('active')} className={`rounded-md px-3 py-2 text-xs font-semibold ${view === 'active' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Active</button><button data-testid="button-completed-tasks" onClick={() => setView('completed')} className={`rounded-md px-3 py-2 text-xs font-semibold ${view === 'completed' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>Completed</button></div></div>{shown.length ? <div className="divide-y divide-border/70">{shown.map(task => <TaskRow key={task.id} task={task} onToggle={() => toggleTask(task.id)} onDelete={() => deleteTask(task.id)} />)}</div> : <EmptyState icon={<ListTodo size={22} />} title={view === 'active' ? 'Nothing asking for you' : 'No finished tasks yet'} text={view === 'active' ? 'Add a task when you are ready. Keep it clear and kind.' : 'Completed tasks will collect here as you make progress.'} />}</div></section></div>;
}

function HabitsPage({ habits, addHabit, toggleHabit, deleteHabit }: { habits: Habit[]; addHabit: (name: string) => void; toggleHabit: (id: string) => void; deleteHabit: (id: string) => void }) {
  const [name, setName] = useState('');
  const submit = () => { addHabit(name); setName(''); };
  return <div className="lumina-appear"><PageHeading eyebrow="Gentle consistency" title="Habits" description="The things you return to become the shape of your days." /><section className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><div className="lumina-card h-fit rounded-[1.5rem] p-6"><div className="mb-5 flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-accent/30 text-primary"><Flame size={17} /></span><h2 className="font-semibold">Start a ritual</h2></div><label className="mb-2 block text-xs font-semibold text-muted-foreground" htmlFor="habit-name">A habit worth repeating</label><input data-testid="input-habit-name" id="habit-name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} placeholder="e.g. Read for ten minutes" className="h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:border-primary" /><button data-testid="button-add-habit" disabled={!name.trim()} onClick={submit} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-40"><Plus size={17} />Add habit</button><div className="mt-6 rounded-xl bg-accent/15 p-4"><p className="text-xs font-semibold text-primary">A useful rule</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Make the habit so small you can do it on your worst day.</p></div></div><div className="lumina-card rounded-[1.5rem] p-6"><div className="mb-5 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">Today’s check-in</p><h2 className="mt-1 text-lg font-semibold">{habits.length ? `${habits.filter(h => h.completedDates.includes(todayKey())).length} of ${habits.length} complete` : 'Your rituals'}</h2></div><CalendarDays size={20} className="text-muted-foreground" /></div>{habits.length ? <div className="space-y-3">{habits.map(habit => { const done = habit.completedDates.includes(todayKey()); return <div key={habit.id} className={`group flex items-center gap-4 rounded-2xl border p-4 transition ${done ? 'border-accent/50 bg-accent/10' : 'border-border/70'}`}><button data-testid={`button-toggle-habit-${habit.id}`} onClick={() => toggleHabit(habit.id)} className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-primary'}`} aria-label={`${done ? 'Uncheck' : 'Complete'} ${habit.name}`}>{done ? <Check size={19} /> : <Sun size={18} />}</button><div className="min-w-0 flex-1"><p className={`font-medium ${done ? 'text-primary' : ''}`}>{habit.name}</p><div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Flame size={13} className={getStreak(habit.completedDates) ? 'text-accent-foreground' : ''} />{getStreak(habit.completedDates)} day streak</span><span>·</span><span>{done ? 'Checked in today' : 'Not yet today'}</span></div></div><button data-testid={`button-delete-habit-${habit.id}`} onClick={() => deleteHabit(habit.id)} className="rounded-lg p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100" aria-label={`Delete ${habit.name}`}><Trash2 size={16} /></button></div>; })}</div> : <EmptyState icon={<Flame size={22} />} title="Nothing to tend yet" text="Create a small ritual and give it a little room in your day." />}</div></section></div>;
}

function FocusPage({ focusMinutes, onComplete, request }: { focusMinutes: number; onComplete: (minutes: number) => void; request: number }) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus'); const [seconds, setSeconds] = useState(25 * 60); const [running, setRunning] = useState(false); const [completed, setCompleted] = useState(false); const lastRequest = useRef(request);
  useEffect(() => { if (request !== lastRequest.current) { lastRequest.current = request; setRunning(true); setMode('focus'); setSeconds(25 * 60); } }, [request]);
  useEffect(() => { if (!running) return; const interval = window.setInterval(() => setSeconds(v => { if (v <= 1) { window.clearInterval(interval); setRunning(false); setCompleted(true); onComplete(mode === 'focus' ? 25 : 5); return 0; } return v - 1; }), 1000); return () => window.clearInterval(interval); }, [running, mode, onComplete]);
  const reset = () => { setRunning(false); setCompleted(false); setSeconds(mode === 'focus' ? 25 * 60 : 5 * 60); };
  const switchMode = (next: 'focus' | 'break') => { setMode(next); setRunning(false); setCompleted(false); setSeconds(next === 'focus' ? 25 * 60 : 5 * 60); };
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0'); const secs = String(seconds % 60).padStart(2, '0');
  return <div className="lumina-appear"><PageHeading eyebrow="One thing at a time" title="Focus" description="A small container for your attention. No pressure to fill it perfectly." /><section className="grid gap-5 lg:grid-cols-[1fr_.7fr]"><div className="lumina-card flex min-h-[510px] flex-col items-center justify-center rounded-[1.5rem] p-8 text-center"><div className="mb-7 flex rounded-xl bg-muted p-1"><button data-testid="button-focus-mode" onClick={() => switchMode('focus')} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold ${mode === 'focus' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><Brain size={15} />Focus · 25 min</button><button data-testid="button-break-mode" onClick={() => switchMode('break')} className={`flex min-h-10 items-center gap-2 rounded-lg px-4 text-xs font-semibold ${mode === 'break' ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}><Coffee size={15} />Break · 5 min</button></div><div className={`grid size-64 place-items-center rounded-full border-[10px] ${running ? 'border-primary/30' : 'border-muted'} ${running ? 'lumina-pulse' : ''}`}><div><span data-testid="text-timer" className="font-mono text-5xl tracking-tight">{minutes}:{secs}</span><span className="mt-2 block font-mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">{running ? 'in session' : completed ? 'complete' : 'ready when you are'}</span></div></div><div className="mt-8 flex items-center gap-3">{!running ? <button data-testid="button-start-timer" onClick={() => { setCompleted(false); setRunning(true); }} className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"><Play size={17} fill="currentColor" />{completed ? 'Start again' : 'Start session'}</button> : <button data-testid="button-pause-timer" onClick={() => setRunning(false)} className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold"><Pause size={17} />Pause</button>}<button data-testid="button-reset-timer" onClick={reset} className="grid size-12 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground" aria-label="Reset timer"><RotateCcw size={17} /></button></div>{completed && <p data-testid="status-focus-complete" className="mt-5 flex items-center gap-2 text-sm font-semibold text-primary lumina-complete"><CheckCircle2 size={17} />Session complete. That time is yours.</p>}</div><div className="space-y-5"><div className="lumina-card rounded-[1.5rem] bg-sidebar p-6 text-sidebar-foreground"><div className="flex items-center gap-2 text-accent"><Zap size={17} /><span className="font-mono text-[10px] uppercase tracking-[.2em]">Your focus bank</span></div><p data-testid="text-focus-bank" className="mt-5 font-serif text-5xl">{focusMinutes}</p><p className="mt-1 text-sm text-sidebar-foreground/55">minutes logged today</p><div className="mt-6 h-px bg-sidebar-border" /><p className="mt-4 text-xs leading-relaxed text-sidebar-foreground/55">The goal is not to become a machine. It is to give your mind a place to land.</p></div><div className="lumina-card rounded-[1.5rem] p-6"><div className="flex items-center gap-2"><CircleHelp size={17} className="text-primary" /><h2 className="font-semibold">A softer start</h2></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">Before you begin, name the one thing you want to leave with. It can be smaller than you think.</p></div></div></section></div>;
}

function NotesPage({ note, updateNote }: { note: Note; updateNote: (note: Note) => void }) {
  const [title, setTitle] = useState(note.title); const [content, setContent] = useState(note.content); const [savedAt, setSavedAt] = useState(note.updatedAt); const timer = useRef<number | undefined>(undefined);
  useEffect(() => { setTitle(note.title); setContent(note.content); }, [note.title, note.content]);
  useEffect(() => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { const updatedAt = new Date().toISOString(); updateNote({ title, content, updatedAt }); setSavedAt(updatedAt); }, 500); return () => window.clearTimeout(timer.current); }, [title, content]); // local autosave
  return <div className="lumina-appear"><PageHeading eyebrow="A place to land" title="Notes" description="Catch the thought before it disappears. This page saves quietly as you write." action={<span data-testid="status-note-saved" className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-accent" />Saved {new Date(savedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>} /><div className="lumina-card mx-auto max-w-4xl rounded-[1.5rem] p-6 md:p-10"><input data-testid="input-note-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Untitled note" className="w-full border-0 bg-transparent font-serif text-3xl outline-none placeholder:text-muted-foreground/40 md:text-4xl" /><div className="my-6 h-px bg-border/70" /><textarea data-testid="input-note-content" value={content} onChange={e => setContent(e.target.value)} placeholder="What’s on your mind?" className="min-h-[420px] w-full resize-none border-0 bg-transparent text-base leading-8 outline-none placeholder:text-muted-foreground/50" /><div className="mt-8 flex items-center justify-between border-t border-border/70 pt-4 text-xs text-muted-foreground"><span>{content.trim() ? `${content.trim().split(/\\s+/).length} words` : 'A blank page is a beginning.'}</span><span className="font-mono text-[10px] uppercase tracking-wider">Private · stored on this device</span></div></div></div>;
}

function SettingsPage({ onReset }: { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return <div className="lumina-appear"><PageHeading eyebrow="Your space" title="Settings" description="A few quiet controls for how Lumina lives on this device." /><div className="lumina-card max-w-2xl rounded-[1.5rem] p-6 md:p-8"><div className="flex items-start justify-between gap-5 border-b border-border/70 pb-7"><div><h2 className="font-semibold">Local storage</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your tasks, habits, note, and focus history stay in this browser. There is no account and nothing leaves this device.</p></div><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/25 text-primary"><Settings2 size={18} /></span></div><div className="pt-7"><h2 className="font-semibold text-destructive">Reset your space</h2><p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">Remove all tasks, habits, notes, and focus minutes. This cannot be undone.</p>{!confirm ? <button data-testid="button-reset-data" onClick={() => setConfirm(true)} className="mt-5 min-h-11 rounded-xl border border-destructive/30 px-4 text-sm font-semibold text-destructive hover:bg-destructive/10">Reset all data</button> : <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm font-semibold">Are you sure?</p><div className="mt-3 flex gap-2"><button data-testid="button-confirm-reset" onClick={() => { onReset(); setConfirm(false); }} className="min-h-10 rounded-lg bg-destructive px-4 text-xs font-semibold text-destructive-foreground">Yes, reset everything</button><button data-testid="button-cancel-reset" onClick={() => setConfirm(false)} className="min-h-10 rounded-lg border border-border px-4 text-xs font-semibold">Cancel</button></div></div>}</div></div></div>;
}

function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-7 text-center"><span className="grid size-11 place-items-center rounded-2xl bg-accent/25 text-primary">{icon}</span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{text}</p>{action && <div className="mt-3">{action}</div>}</div>;
}

function ChatPanel({ open, messages, onClose, onSend }: { open: boolean; messages: ChatMessage[]; onClose: () => void; onSend: (message: string) => void }) {
  const [input, setInput] = useState('');
  const send = (text = input) => { if (!text.trim()) return; onSend(text); setInput(''); };
  if (!open) return null;
  return <div className="fixed bottom-5 right-5 z-50 flex w-[calc(100vw-40px)] max-w-[390px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-sidebar/20 md:bottom-8 md:right-8"><div className="flex items-center justify-between bg-sidebar px-5 py-4 text-sidebar-foreground"><div className="flex items-center gap-3"><LuminaAvatar size={38} /><div><p className="text-sm font-semibold">Lumina AI</p><p className="font-mono text-[9px] uppercase tracking-widest text-sidebar-foreground/55">local companion</p></div></div><button data-testid="button-close-chat" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Close chat"><X size={18} /></button></div><div className="lumina-scrollbar flex max-h-[350px] min-h-[220px] flex-col gap-3 overflow-y-auto bg-background/80 p-4">{messages.map((message, index) => <div key={`${message.role}-${index}`} className={`max-w-[88%] rounded-2xl px-3.5 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'self-end rounded-br-md bg-primary text-primary-foreground' : 'self-start rounded-bl-md bg-muted text-foreground'}`}>{message.content}</div>)}</div><div className="border-t border-border bg-card p-3"><div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">{['Add Task', 'Today’s Tasks', 'My Progress', 'Start Focus', 'Motivate Me'].map(action => <button key={action} data-testid={`button-chat-${action.toLowerCase().replaceAll(' ', '-')}`} onClick={() => send(action === 'Add Task' ? 'add task ' : action)} className="shrink-0 rounded-full border border-border px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground transition hover:border-primary hover:text-primary">{action}</button>)}</div><div className="flex items-center gap-2 rounded-xl border border-input bg-background px-3"><input data-testid="input-chat-message" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask Lumina anything..." className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /><button data-testid="button-send-chat" onClick={() => send()} className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40" disabled={!input.trim()} aria-label="Send message"><Send size={15} /></button></div></div></div>;
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={AppShell} /><Route path="/tasks" component={AppShell} /><Route path="/habits" component={AppShell} /><Route path="/focus" component={AppShell} /><Route path="/notes" component={AppShell} /><Route path="/settings" component={AppShell} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;