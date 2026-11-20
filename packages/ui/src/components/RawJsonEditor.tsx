import React from 'react';
import Editor from '@monaco-editor/react';

interface RawJsonEditorProps {
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export const RawJsonEditor: React.FC<RawJsonEditorProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  return (
    <div className="w-full h-full">
      <Editor
        height="100%"
        defaultLanguage="json"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          wordWrap: 'on',
          readOnly,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          fontFamily: 'monospace',
          lineNumbers: 'on',
          renderLineHighlight: 'all',
        }}
      />
    </div>
  );
};
