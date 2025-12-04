
import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2, Files } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../i18n';

interface FileUploadProps {
  onFileUpload: (files: File[]) => void;
  isLoading: boolean;
  language: Language;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, isLoading, language }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = translations[language];

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (files: File[]) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];

    const validFiles = files.filter(file => 
      validTypes.includes(file.type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    );

    if (validFiles.length > 0) {
      onFileUpload(validFiles);
    } else {
      alert(t.invalidFile);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-all duration-300 ease-in-out
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:bg-gray-50'}
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls"
          multiple
          onChange={handleChange}
        />

        {isLoading ? (
          <div className="flex flex-col items-center animate-pulse">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-lg font-medium text-gray-600">{t.parsing}</p>
            <p className="text-sm text-gray-400 mt-2">{t.wait}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center p-6">
            <div className="bg-blue-100 p-4 rounded-full mb-4 relative">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-blue-100">
                <Files className="w-4 h-4 text-blue-500" />
              </div>
            </div>
            <p className="text-xl font-semibold text-gray-700 mb-2">
              {t.dropFile}
            </p>
            <p className="text-sm text-gray-500 mb-6 max-w-sm">
              {t.uploadDesc}
            </p>
            <button
              onClick={onButtonClick}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {t.selectFile}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUpload;
