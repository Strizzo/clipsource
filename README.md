# ClipSource

A VS Code extension that copies your Python codebase as markdown, perfect for sharing code with AI assistants or documentation.

## Features

- Copy Python files as markdown with a right-click in the file explorer
- Automatically ignores common directories (venv, node_modules, etc.)
- Configurable file and line limits
- Preserves directory structure in the output

## Usage

1. Right-click on a file or folder in the VS Code explorer
2. Select "Copy Codebase as Markdown"
3. The code will be copied to your clipboard in markdown format

## Extension Settings

This extension contributes the following settings:

* `clipsource.maxFiles`: Maximum number of files to process (default: 50)
* `clipsource.maxTotalLines`: Maximum total lines of code to process (default: 5000)
* `clipsource.ignoreDirs`: Directories to ignore
* `clipsource.ignorePatterns`: File patterns to ignore (glob patterns)

## License

MIT