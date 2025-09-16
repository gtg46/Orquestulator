import { useRef } from 'react';
import { Editor } from '@monaco-editor/react';

// You can't directly import CSS variables into JS, but you can read them at runtime:
const getCssVar = (name) =>
    getComputedStyle(document.documentElement).getPropertyValue(name)

const OrquestulatorEditor = (props) => {
    const editorRef = useRef(null);

    const handleEditorWillMount = (monaco) => {
        monaco.editor.defineTheme('orquestulator', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': getCssVar('--bg-tertiary'),
            }
        });
    };

    const handleEditorDidMount = (editor, _monaco) => {
        editorRef.current = editor;
    }


    // Define default options
    const defaultOptions = {
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        overviewRulerBorder: false,
        hideCursorInOverviewRuler: true,
        overviewRulerLanes: 0,
        renderLineHighlight: 'none',
        folding: false,
        lineNumbers: 'off',
        lineDecorationsWidth: 10,
        padding: { top: 10, bottom: 10 },
        stickyScroll: { enabled: false },
        scrollbar: { alwaysConsumeMouseWheel: false }
    };

    // Extract options and other props without mutating the original props
    const { options: passedOptions = {}, ...otherProps } = props;

    return (
        <Editor
            height={"50vh"}
            theme="orquestulator"
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
            options={{
                ...defaultOptions,
                ...passedOptions
            }}
            {...otherProps}
        />
    )
}

export default OrquestulatorEditor
