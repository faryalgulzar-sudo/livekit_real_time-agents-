'use client';

import { useState, useRef } from 'react';

interface FileUploadProps {
  isConnected: boolean;
  sessionId?: string;
}

export default function FileUpload({ isConnected, sessionId }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadStatus('Uploading...');

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        if (sessionId) {
          formData.append('session_id', sessionId);
        }

        const response = await fetch('http://localhost:8000/v1/files/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
      }

      setUploadStatus(`Successfully uploaded ${files.length} file(s)`);
      setFiles([]);
    } catch (error) {
      setUploadStatus(`Error: ${error instanceof Error ? error.message : 'Upload failed'}`);
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('image')) return '🖼️';
    if (type.includes('dicom') || type.includes('dcm')) return '🩻';
    return '📁';
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-5 text-slate-100 flex items-center gap-2">
        <span>📎</span>
        <span>Document Upload</span>
      </h2>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isConnected
            ? 'border-indigo-500/50 hover:border-indigo-500 hover:bg-indigo-500/10'
            : 'border-slate-600 opacity-50 cursor-not-allowed'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.dcm"
          onChange={handleFileSelect}
          className="hidden"
          disabled={!isConnected}
        />
        <div className="text-4xl mb-3">📤</div>
        <p className="text-slate-300 font-medium">
          {isConnected
            ? 'Drop files here or click to browse'
            : 'Connect to upload files'}
        </p>
        <p className="text-slate-500 text-sm mt-2">
          Supported: PDF, Images, DICOM
        </p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-slate-400 text-sm font-medium">
            Selected Files ({files.length})
          </p>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-slate-900 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{getFileIcon(file.type)}</span>
                <div>
                  <p className="text-slate-200 font-medium truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="text-red-400 hover:text-red-300 transition-colors p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={uploadFiles}
          disabled={uploading || !isConnected}
          className="w-full mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-300"
        >
          {uploading ? (
            <>
              <span className="animate-spin">⏳</span>
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <span>📤</span>
              <span>Upload {files.length} File(s)</span>
            </>
          )}
        </button>
      )}

      {/* Status Message */}
      {uploadStatus && (
        <p
          className={`mt-3 text-sm text-center ${
            uploadStatus.includes('Error') ? 'text-red-400' : 'text-green-400'
          }`}
        >
          {uploadStatus}
        </p>
      )}
    </div>
  );
}
