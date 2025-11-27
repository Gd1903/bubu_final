'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, Check, SwitchCamera, Loader2, CameraOff } from 'lucide-react';

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureDialog({ open, onOpenChange, onCapture }: CameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 🔥 MẶC ĐỊNH LÀ 'user' (Camera trước)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user'); 

  // Hàm tắt camera
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Khởi động Camera
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Tắt stream cũ nếu đang chạy
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      console.log("Đang yêu cầu camera:", facingMode);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          // Chỉ yêu cầu facingMode, để trình duyệt tự chọn resolution tốt nhất
          facingMode: facingMode 
        },
        audio: false
      });
      
      setStream(newStream);
    } catch (err: any) {
      console.error("Lỗi Camera:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Vui lòng cho phép quyền truy cập Camera trên trình duyệt.");
      } else if (err.name === 'NotFoundError') {
        setError("Không tìm thấy thiết bị Camera nào.");
      } else {
        setError("Không thể bật Camera. Hãy thử tải lại trang hoặc kiểm tra kết nối.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]); // Chỉ chạy lại khi đổi camera (facingMode thay đổi)

  // Quản lý vòng đời mở/đóng dialog
  useEffect(() => {
    if (open && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    // Cleanup khi unmount
    return () => {
       // React sẽ xử lý cleanup effect, logic stopCamera ở trên đã đủ
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, capturedImage]); // Bỏ startCamera ra khỏi deps để tránh loop vô hạn

  // 🔥 Gán stream vào video và ép chạy (Play)
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.error("Lỗi phát video:", e));
      };
    }
  }, [stream]);

  // Chụp ảnh
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      const width = video.videoWidth;
      const height = video.videoHeight;

      canvas.width = width;
      canvas.height = height;
      
      const context = canvas.getContext('2d');
      if (context) {
        // 🔥 LOGIC LẬT ẢNH QUAN TRỌNG:
        // Chỉ lật ảnh nếu đang ở chế độ Camera trước ('user')
        // Camera sau ('environment') giữ nguyên để chữ không bị ngược
        if (facingMode === 'user') {
           context.translate(width, 0);
           context.scale(-1, 1);
        }

        context.drawImage(video, 0, 0, width, height);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageDataUrl);
        stopCamera();
      }
    }
  };

  const handleConfirm = async () => {
    if (capturedImage) {
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const file = new File([blob], `cam-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
      handleClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    // startCamera sẽ tự chạy lại nhờ useEffect ở trên
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    onOpenChange(false);
  };

  const toggleCamera = () => {
    // Đảo trạng thái facingMode -> startCamera sẽ tự chạy lại nhờ dependency
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-black border-slate-800 text-white gap-0">
        <div className="relative aspect-[3/4] bg-slate-900 flex items-center justify-center overflow-hidden">
          
          {/* VIDEO STREAM */}
          {!capturedImage && !error && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              // 🔥 CSS LẬT GƯƠNG: Chỉ lật khi là camera trước (user)
              // Camera sau (environment) hiển thị bình thường để đọc chữ
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} 
            />
          )}

          {/* LOADING */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-2" />
                <span className="text-sm text-slate-400">Đang bật Camera...</span>
            </div>
          )}

          {/* ẢNH ĐÃ CHỤP */}
          {capturedImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capturedImage} alt="Captured" className="w-full h-full object-contain bg-black" />
          )}

          {/* HIỂN THỊ LỖI */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 p-6 text-center z-20">
                <CameraOff className="w-12 h-12 text-red-500 mb-4" />
                <p className="text-red-400 font-medium mb-2">Lỗi Camera</p>
                <p className="text-sm text-slate-400">{error}</p>
                <Button variant="outline" className="mt-4 border-slate-600 text-black hover:bg-slate-800 hover:text-white" onClick={handleClose}>
                    Đóng
                </Button>
            </div>
          )}

          {/* NÚT ĐẢO CAMERA (Chỉ hiện khi đang xem live và không lỗi) */}
          {!capturedImage && !error && !isLoading && (
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute top-4 right-4 rounded-full bg-black/40 hover:bg-black/60 text-white border-none backdrop-blur-md z-10"
              onClick={toggleCamera}
              title="Đổi Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* CONTROLS AREA */}
        <div className="p-6 bg-slate-950 flex justify-between items-center h-24">
          {!capturedImage ? (
            <>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={handleClose}>
                Hủy
              </Button>
              
              <button 
                className="w-16 h-16 rounded-full border-4 border-white ring-2 ring-offset-2 ring-offset-slate-950 ring-blue-500 bg-white/10 hover:bg-white/30 active:scale-95 transition-all disabled:opacity-50"
                onClick={handleCapture}
                disabled={!!error || isLoading}
              />
              
              <div className="w-16"></div> 
            </>
          ) : (
            <div className="flex w-full gap-4">
              <Button variant="outline" onClick={handleRetake} className="flex-1 border-slate-700 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className="w-4 h-4 mr-2" /> Chụp lại
              </Button>
              <Button onClick={handleConfirm} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-none">
                <Check className="w-4 h-4 mr-2" /> Sử dụng
              </Button>
            </div>
          )}
        </div>

        {/* Canvas ẩn để xử lý ảnh */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}