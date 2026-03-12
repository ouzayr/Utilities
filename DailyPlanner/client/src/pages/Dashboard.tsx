import { useTaskStore } from "@/lib/storage";
import { useState } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subDays, addDays, parseISO } from "date-fns";
import { TrendingUp, CheckCircle, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { tasks } = useTaskStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start, end });
  
  const weeklyData = days.map(day => {
    const dayTasks = tasks.filter(t => t.date === format(day, "yyyy-MM-dd"));
    return {
      name: format(day, 'EEE'),
      total: dayTasks.length,
      completed: dayTasks.filter(t => t.completed).length,
      cancelled: dayTasks.filter(t => t.cancelled).length,
    };
  });

  const weekTasks = tasks.filter(t => {
    const d = parseISO(t.date);
    return d >= start && d <= end;
  });

  const totalTasks = weekTasks.length;
  const totalCompleted = weekTasks.filter(t => t.completed).length;
  const totalCancelled = weekTasks.filter(t => t.cancelled).length;
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <div className="container max-w-4xl py-12 font-serif">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-5xl font-bold italic text-primary">Weekly Insights</h1>
          <p className="text-muted-foreground text-lg mt-2">
            {format(start, "MMM d")} - {format(end, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-lg">
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subDays(currentDate, 7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatsCard 
          title="Completion Rate" 
          value={`${completionRate}%`}
          icon={<TrendingUp className="w-5 h-5" />}
          description="Overall follow-through"
        />
        <StatsCard 
          title="Finished Tasks" 
          value={totalCompleted}
          icon={<CheckCircle className="w-5 h-5" />}
          description="Total items completed"
        />
        <StatsCard 
          title="Cancelled" 
          value={totalCancelled}
          icon={<Clock className="w-5 h-5" />}
          description="Tasks let go"
        />
      </div>

      <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 border border-border shadow-xl">
        <h3 className="text-2xl font-semibold text-primary mb-8 italic">Weekly Rhythm</h3>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--muted-foreground)', fontSize: 14 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip 
                cursor={{ fill: 'var(--muted)', opacity: 0.1 }}
                contentStyle={{ 
                  borderRadius: '12px', 
                  border: 'none', 
                  boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  fontFamily: 'var(--font-serif)'
                }}
              />
              <Bar dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="completed" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, icon, description }: { title: string, value: string | number, icon: React.ReactNode, description: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/50 backdrop-blur-sm p-8 rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="p-3 bg-primary/10 rounded-xl text-primary">
          {icon}
        </div>
        <span className="text-xs font-sans text-muted-foreground uppercase tracking-widest font-bold">{title}</span>
      </div>
      <div className="text-5xl font-bold text-primary mb-2">
        {value}
      </div>
      <p className="text-muted-foreground italic">{description}</p>
    </motion.div>
  );
}
