@echo off
REM Build script — produces a single markdown_editor.exe in the dist\ folder.
REM Run this once from a Command Prompt (or PowerShell) inside this directory.

echo Installing / updating dependencies...
pip install -r requirements.txt
pip install pyinstaller

echo.
echo Building standalone executable...
pyinstaller ^
  --onefile ^
  --windowed ^
  --name "MarkdownEditor" ^
  --icon NONE ^
  markdown_editor.py

echo.
if exist dist\MarkdownEditor.exe (
    echo Build successful!  Executable is at dist\MarkdownEditor.exe
) else (
    echo Build may have failed — check the output above for errors.
)
pause
