
import { useState, useRef } from 'react';
import { UploadCloud, FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { deviceService } from '@/services/deviceService';

interface LogUploaderProps {
    deviceId: string;
    onUploadComplete: (count: number) => void;
}

export default function LogUploader({ deviceId, onUploadComplete }: LogUploaderProps) {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        try {
            setUploading(true);
            const result = await deviceService.uploadTrafficLogs(deviceId, file);
            toast.success(`Successfully processed ${result.count} log entries`);
            onUploadComplete(result.count);
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Failed to upload logs");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-12 bg-gray-50/50 rounded-xl border-2 border-dashed border-gray-200">
            {!file ? (
                <>
                    <div
                        className={cn(
                            "w-full h-64 flex flex-col items-center justify-center cursor-pointer transition-colors rounded-lg",
                            dragActive ? "bg-blue-50 border-blue-200" : ""
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => inputRef.current?.click()}
                    >
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                            <UploadCloud className="h-8 w-8 text-blue-500" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Upload Traffic Logs</h3>
                        <p className="text-sm text-gray-500 mb-4 max-w-sm text-center">
                            Drag and drop your Syslog export (CSV or TXT) here to start the tuning analysis.
                        </p>
                        <Button variant="outline" size="sm">Select File</Button>
                        <input
                            ref={inputRef}
                            type="file"
                            className="hidden"
                            accept=".csv,.txt,.log"
                            onChange={handleChange}
                        />
                    </div>
                </>
            ) : (
                <div className="w-full max-w-md bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded text-blue-600">
                                <FileText className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">{file.name}</h4>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-500"
                            onClick={() => setFile(null)}
                            disabled={uploading}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <Button
                        className="w-full"
                        onClick={handleUpload}
                        disabled={uploading}
                    >
                        {uploading ? "Analyzing Logs..." : "Start Tuning"}
                    </Button>
                </div>
            )}
        </div>
    );
}
