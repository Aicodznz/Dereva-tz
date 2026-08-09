import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, PenTool, Check, Trash2, ShieldCheck, X, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProofOfDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  recipientName?: string;
  onComplete: (data: { signatureDataUrl?: string; photoDataUrl?: string; recipientName: string }) => void;
}

export const ProofOfDeliveryModal: React.FC<ProofOfDeliveryModalProps> = ({
  isOpen,
  onClose,
  orderId,
  recipientName = "Juma Rashidi",
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [name, setName] = useState(recipientName);

  // Canvas Drawing Handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#10b981'; // emerald-500
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasSignature) setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target?.result as string);
        toast.success("Picha ya uwasilishaji mzigo imehifadhiwa!");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSignature && !photoUrl) {
      toast.error("Tafadhali weka saini au picha ya mzigo kama uthibitisho!");
      return;
    }

    let signatureDataUrl: string | undefined;
    if (hasSignature && canvasRef.current) {
      signatureDataUrl = canvasRef.current.toDataURL('image/png');
    }

    toast.success("Uwasilishaji wa mzigo umethibitishwa kikamilifu! 📦✨", {
      description: "Saini na picha ya mzigo vimehifadhiwa kwenye risiti.",
    });

    onComplete({
      signatureDataUrl,
      photoDataUrl: photoUrl || undefined,
      recipientName: name,
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-5 overflow-hidden max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-[0.2em] block">UTHIBITISHO WA MZIGO</span>
                <h3 className="text-lg font-black italic uppercase tracking-tight text-neutral-900 dark:text-white">Proof of Delivery</h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white flex items-center justify-center border-0 outline-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Recipient Name Field */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">Jina la Mpokeaji Mzigo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Weka jina la mpokeaji"
                className="w-full h-11 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-bold text-xs outline-none"
              />
            </div>

            {/* Signature Canvas Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5 text-emerald-500" /> Saini ya Mpokeaji (Sign Below)
                </label>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-[9px] font-black uppercase text-red-500 hover:underline flex items-center gap-1 border-0 bg-transparent"
                  >
                    <Trash2 className="w-3 h-3" /> Futa Saini
                  </button>
                )}
              </div>

              <div className="relative bg-neutral-50 dark:bg-neutral-950 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-800 overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={340}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-[130px] touch-none cursor-crosshair"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-neutral-400 text-xs font-bold uppercase tracking-widest opacity-40">
                    Weka Saini Hapa...
                  </div>
                )}
              </div>
            </div>

            {/* Photo Upload Option */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1">
                <Camera className="w-3.5 h-3.5 text-emerald-500" /> Picha ya Mzigo Uliowasilishwa
              </label>

              {photoUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/30 h-28 bg-black/40 flex items-center justify-center">
                  <img src={photoUrl} alt="Delivery proof" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotoUrl(null)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-red-600 text-white shadow-md border-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-14 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-dashed border-neutral-300 dark:border-neutral-800 hover:border-emerald-500 text-neutral-500 hover:text-emerald-500 cursor-pointer transition-all">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-xs font-black uppercase tracking-wider">Piga au Chagua Picha ya Mzigo</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-widest italic text-xs flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 border-0 outline-none"
            >
              <CheckCircle2 className="w-5 h-5" /> Kamilisha Uwasilishaji Mzigo
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
