import { useState, useRef, useEffect } from "react";
import { useTaskStore } from "@/lib/storage";
import { Task } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Camera, PenTool, Type, Image as ImageIcon, Save, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TaskDetailsModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailsModal({ task, onClose }: TaskDetailsModalProps) {
  const { updateTask, getAllTasks } = useTaskStore();
  const [priority, setPriority] = useState("Medium");
  const [category, setCategory] = useState("");
  const [client, setClient] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");
  const [handwrittenNotes, setHandwrittenNotes] = useState("");
  const [attachments, setAttachments] = useState<{url: string, name: string}[]>([]);
  const [mode, setMode] = useState<"type" | "draw">("type");
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    if (task) {
      setPriority(task.priority || "Medium");
      setCategory(task.category || "");
      setClient(task.client || "");
      setTags(task.tags || []);
      setNotes(task.notes || "");
      setHandwrittenNotes(task.handwrittenNotes || "");
      setAttachments(task.attachments || []);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;
    let finalHandwritten = handwrittenNotes;
    if (mode === "draw" && canvasRef.current) {
      finalHandwritten = canvasRef.current.toDataURL();
    }
    updateTask(task.id, {
      priority,
      category,
      client,
      tags,
      notes,
      handwrittenNotes: finalHandwritten,
      attachments,
    });
    
    // Trigger download on save
    const allTasks = getAllTasks();
    const blob = new Blob([JSON.stringify(allTasks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diary_data_${format(new Date(), "yyyy-MM-dd")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    onClose();
  };

  const addTag = () => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments([...attachments, { url: reader.result as string, name: file.name }]);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (mode === "draw" && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        
        if (handwrittenNotes) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = handwrittenNotes;
        }
      }
    }
  }, [mode, handwrittenNotes]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    draw(e);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    if (canvasRef.current) {
      setHandwrittenNotes(canvasRef.current.toDataURL());
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ("touches" in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ("touches" in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  if (!task) return null;

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-serif">
        <DialogHeader>
          <DialogTitle className="text-2xl italic border-b pb-2">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 py-4">
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="font-serif italic">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Low">Low (Blue)</SelectItem>
                <SelectItem value="Medium">Medium (Orange)</SelectItem>
                <SelectItem value="High">High (Red)</SelectItem>
                <SelectItem value="Urgent">Urgent (Purple)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Input 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Work, Personal, etc."
              className="font-serif italic"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 py-2">
          <div className="space-y-2">
            <Label>Client</Label>
            <Input 
              value={client} 
              onChange={(e) => setClient(e.target.value)}
              placeholder="Client name"
              className="font-serif italic"
            />
          </div>
        </div>

        <div className="space-y-2 py-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-serif">
                {tag}
                <button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input 
              value={tagInput} 
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTag()}
              placeholder="Add tag..."
              className="font-serif italic"
            />
            <Button onClick={addTag} variant="outline" size="sm">Add</Button>
          </div>
        </div>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label className="text-lg">Notes</Label>
            <div className="flex gap-2 bg-muted p-1 rounded-md">
              <Button 
                variant={mode === "type" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setMode("type")}
              >
                <Type className="h-4 w-4 mr-2" /> Type
              </Button>
              <Button 
                variant={mode === "draw" ? "secondary" : "ghost"} 
                size="sm" 
                onClick={() => setMode("draw")}
              >
                <PenTool className="h-4 w-4 mr-2" /> Draw
              </Button>
            </div>
          </div>

          {mode === "type" ? (
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Write your thoughts..."
              className="min-h-[200px] font-serif italic text-lg leading-relaxed bg-white/50"
            />
          ) : (
            <div className="border rounded-md bg-white overflow-hidden touch-none relative">
              <canvas 
                ref={canvasRef}
                width={600}
                height={300}
                className="w-full cursor-crosshair"
                onMouseDown={startDrawing}
                onMouseUp={stopDrawing}
                onMouseMove={draw}
                onTouchStart={startDrawing}
                onTouchEnd={stopDrawing}
                onTouchMove={draw}
              />
            </div>
          )}
        </div>

        <div className="space-y-4 py-4">
          <Label className="text-lg">Attachments</Label>
          <div className="grid grid-cols-4 gap-4">
            {attachments.map((file, i) => (
              <div key={i} className="relative group aspect-square border rounded-md overflow-hidden bg-muted">
                <img src={file.url} alt={file.name} className="object-cover w-full h-full" />
                <button 
                  onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 aspect-square">
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs mt-1 text-muted-foreground">Attach</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
            <label className="border-2 border-dashed rounded-md flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 aspect-square">
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs mt-1 text-muted-foreground">Photo</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">
            <Save className="h-4 w-4 mr-2" /> Save Entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
