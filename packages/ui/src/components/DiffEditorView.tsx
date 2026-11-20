import React from 'react';
import { DiffEditor } from '@monaco-editor/react';

interface DiffEditorViewProps {
  originalJson: string;
  modifiedJson: string;
}

export const DiffEditorView: React.FC<DiffEditorViewProps> = ({
  originalJson,
  modifiedJson,
}) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="h-8 border-b border-zinc-800 bg-zinc-950 px-4 flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <span>ORIGINAL REQUEST FROM AGENT</span>
        <span>MODIFIED REQUEST TO MODEL</span>
      </div>
      <div className="flex-1">
        <DiffEditor
          height="100%"
          language="json"
          theme="vs-dark"
          original={originalJson}
          modified={modifiedJson}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
  );
};
