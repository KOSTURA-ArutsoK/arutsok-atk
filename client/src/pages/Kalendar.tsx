import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Loader2,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CalendarEvent } from "@shared/schema";

const COLORS = [
  { value: "#3b82f6", label: "Modra" },
  { value: "#ef4444", label: "Cervena" },
  { value: "#22c55e", label: "Zelena" },
  { value: "#f59e0b", label: "Zlta" },
  { value: "#8b5cf6", label: "Fialova" },
  { value: "#ec4899", label: "Ruzova" },
  { value: "#06b6d4", label: "Tyrkysova" },
  { value: "#f97316", label: "Oranzova" },
];

const DAYS_SK = ["Po", "Ut", "St", "St", "Pi", "So", "Ne"];
const MONTHS_SK = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default function Kalendar() {
  const { toast } = useToast();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState("#3b82f6");

  const { data: events = [], isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
  });

  function invalidateCalendar() {
    queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
    queryClient.invalidateQueries({ queryKey: ["/api/calendar-events/upcoming"] });
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/calendar-events", data),
    onSuccess: () => {
      invalidateCalendar();
      toast({ title: "Udalost vytvorena" });
      closeDialog();
    },
    onError: () => toast({ title: "Chyba pri vytvarani udalosti", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/calendar-events/${id}`, data),
    onSuccess: () => {
      invalidateCalendar();
      toast({ title: "Udalost aktualizovana" });
      closeDialog();
    },
    onError: () => toast({ title: "Chyba pri aktualizacii", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/calendar-events/${id}`),
    onSuccess: () => {
      invalidateCalendar();
      toast({ title: "Udalost vymazana" });
      setDeleteConfirmId(null);
    },
    onError: () => toast({ title: "Chyba pri mazani", variant: "destructive" }),
  });

  function closeDialog() {
    setDialogOpen(false);
    setEditingEvent(null);
    setTitle("");
    setDescription("");
    setStartDate("");
    setStartTime("09:00");
    setEndDate("");
    setEndTime("10:00");
    setAllDay(false);
    setColor("#3b82f6");
  }

  function openCreate(date?: Date) {
    setEditingEvent(null);
    const d = date || new Date();
    setTitle("");
    setDescription("");
    setStartDate(formatDate(d));
    setStartTime("09:00");
    setEndDate(formatDate(d));
    setEndTime("10:00");
    setAllDay(false);
    setColor("#3b82f6");
    setDialogOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    setEditingEvent(event);
    const sd = new Date(event.startDate);
    setTitle(event.title);
    setDescription(event.description || "");
    setStartDate(formatDate(sd));
    setStartTime(formatTime(sd));
    if (event.endDate) {
      const ed = new Date(event.endDate);
      setEndDate(formatDate(ed));
      setEndTime(formatTime(ed));
    } else {
      setEndDate(formatDate(sd));
      setEndTime("10:00");
    }
    setAllDay(event.allDay || false);
    setColor(event.color || "#3b82f6");
    setDialogOpen(true);
  }

  function handleSave() {
    if (!title.trim() || !startDate) return;
    const sd = allDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}:00`);
    const ed = endDate
      ? (allDay ? new Date(`${endDate}T23:59:59`) : new Date(`${endDate}T${endTime}:00`))
      : null;
    const payload = { title: title.trim(), description, startDate: sd.toISOString(), endDate: ed?.toISOString() || null, allDay, color };
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  function goToday() {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const today = new Date();

  const calendarDays = useMemo(() => {
    const days: { date: Date; isCurrentMonth: boolean }[] = [];
    const prevMonthDays = getDaysInMonth(currentYear, currentMonth - 1);
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ date: new Date(currentYear, currentMonth - 1, prevMonthDays - i), isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(currentYear, currentMonth, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(currentYear, currentMonth + 1, i), isCurrentMonth: false });
    }
    return days;
  }, [currentYear, currentMonth, daysInMonth, firstDay]);

  function getEventsForDay(date: Date) {
    return events.filter(e => {
      const sd = new Date(e.startDate);
      if (isSameDay(sd, date)) return true;
      if (e.endDate) {
        const ed = new Date(e.endDate);
        return date >= sd && date <= ed;
      }
      return false;
    });
  }

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Kalendar</h1>
        </div>
        <Button onClick={() => openCreate()} data-testid="button-create-event">
          <Plus className="w-4 h-4 mr-1" />
          Nova udalost
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <CardTitle className="text-lg min-w-[180px] text-center" data-testid="text-current-month">
              {MONTHS_SK[currentMonth]} {currentYear}
            </CardTitle>
            <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday} data-testid="button-today">
            Dnes
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {["Po", "Ut", "St", "Stv", "Pi", "So", "Ne"].map((d, i) => (
                <div key={i} className="bg-muted px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">
                  {d}
                </div>
              ))}
              {calendarDays.map(({ date, isCurrentMonth }, idx) => {
                const dayEvents = getEventsForDay(date);
                const isToday = isSameDay(date, today);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                return (
                  <div
                    key={idx}
                    className={`bg-card min-h-[80px] p-1 cursor-pointer transition-colors ${
                      !isCurrentMonth ? "opacity-40" : ""
                    } ${isSelected ? "ring-2 ring-primary ring-inset" : ""}`}
                    onClick={() => setSelectedDate(date)}
                    onDoubleClick={() => openCreate(date)}
                    data-testid={`calendar-day-${formatDate(date)}`}
                  >
                    <div className={`text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? "bg-primary text-primary-foreground" : ""
                    }`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <div
                          key={e.id}
                          className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white cursor-pointer"
                          style={{ backgroundColor: e.color || "#3b82f6" }}
                          onClick={(ev) => { ev.stopPropagation(); openEdit(e); }}
                          data-testid={`event-chip-${e.id}`}
                        >
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} dalsie</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedDate && (
        <Card data-testid="panel-day-events">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">
              {selectedDate.getDate()}. {MONTHS_SK[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </CardTitle>
            <Button size="sm" onClick={() => openCreate(selectedDate)} data-testid="button-add-event-day">
              <Plus className="w-3 h-3 mr-1" />
              Pridat
            </Button>
          </CardHeader>
          <CardContent>
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-events">
                Ziadne udalosti v tento den
              </p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map(e => {
                  const sd = new Date(e.startDate);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 p-2 rounded-md border border-border"
                      data-testid={`event-row-${e.id}`}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.color || "#3b82f6" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`event-title-${e.id}`}>{e.title}</p>
                        {!e.allDay && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(sd)}
                            {e.endDate && ` - ${formatTime(new Date(e.endDate))}`}
                          </p>
                        )}
                        {e.allDay && <Badge variant="secondary" className="text-[10px]">Celodenni</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(e)} data-testid={`button-edit-event-${e.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={() => setDeleteConfirmId(e.id)} data-testid={`button-delete-event-${e.id}`}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle data-testid="text-event-dialog-title">
              {editingEvent ? "Upravit udalost" : "Nova udalost"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nazov udalosti *</label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="napr. Stretnutie s klientom"
                data-testid="input-event-title"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Popis</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Volitelny popis udalosti..."
                className="resize-none"
                data-testid="input-event-description"
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={allDay} onCheckedChange={setAllDay} data-testid="switch-all-day" />
              <label className="text-sm font-medium">Celodenna udalost</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Datum zaciatku *</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} data-testid="input-start-date" />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cas zaciatku</label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} data-testid="input-start-time" />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Datum konca</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} data-testid="input-end-date" />
              </div>
              {!allDay && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Cas konca</label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} data-testid="input-end-time" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Farba</label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger data-testid="select-event-color">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {COLORS.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                        <span>{c.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel-event">Zrusit</Button>
              <Button onClick={handleSave} disabled={!title.trim() || !startDate || isPending} data-testid="button-save-event">
                {isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingEvent ? "Ulozit zmeny" : "Vytvorit"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Vymazat udalost?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tato akcia je nevratna. Udalost bude trvalo odstranena.</p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">Zrusit</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Vymazat
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
