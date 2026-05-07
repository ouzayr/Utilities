#!/usr/bin/env python3
"""
Lightweight Markdown Editor & Viewer for Windows 11.

Features:
  - Split view: live markdown preview alongside the editor
  - Syntax highlighting in the editor (headings, bold, italic, code, links, etc.)
  - File browser sidebar for navigating folders
  - Find & replace with case-sensitive and regex options
  - Dark / light mode toggle
  - PDF export via Qt's built-in renderer
  - Tables, fenced code blocks with language-aware syntax highlighting,
    KaTeX math ($...$ and $$...$$), and Mermaid diagrams

Requirements: pip install PySide6 markdown
Build to .exe: pip install pyinstaller && pyinstaller --onefile --windowed markdown_editor.py
"""

import os
import re
import sys
from pathlib import Path

import markdown as md_lib
from markdown.extensions.toc import TocExtension

from PySide6.QtCore import (
    QDir,
    QRegularExpression,
    QTimer,
    QUrl,
    Qt,
)
from PySide6.QtGui import (
    QAction,
    QColor,
    QFont,
    QKeySequence,
    QTextCharFormat,
    QTextCursor,
    QTextDocument,
)
from PySide6.QtWebEngineCore import QWebEngineSettings
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QApplication,
    QCheckBox,
    QFileDialog,
    QFileSystemModel,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QSplitter,
    QStatusBar,
    QToolBar,
    QTreeView,
    QVBoxLayout,
    QWidget,
)

# Keep a reference so the highlighter base class doesn't get GC'd early
from PySide6.QtGui import QSyntaxHighlighter  # noqa: F401 (re-exported for clarity)

# ─── HTML Preview Template ────────────────────────────────────────────────────

_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">

<!-- Highlight.js -->
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/{hljs_theme}.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>

<!-- KaTeX -->
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer
        src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
        onload="renderMathInElement(document.body, {{
            delimiters: [
                {{left: '$$', right: '$$', display: true}},
                {{left: '$',  right: '$',  display: false}},
                {{left: '\\\\(', right: '\\\\)', display: false}},
                {{left: '\\\\[', right: '\\\\]', display: true}}
            ],
            throwOnError: false
        }});"></script>

<!-- Mermaid -->
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>

<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                 'Helvetica Neue', Arial, sans-serif;
    font-size: 16px;
    line-height: 1.75;
    color: {fg};
    background: {bg};
    padding: 28px 40px;
    max-width: 900px;
    margin: 0 auto;
}}
h1, h2, h3, h4, h5, h6 {{
    font-weight: 600;
    line-height: 1.3;
    margin: 1.5em 0 0.5em;
    color: {heading_fg};
}}
h1 {{ font-size: 2em;    border-bottom: 2px solid {border}; padding-bottom: .3em; margin-top: 0; }}
h2 {{ font-size: 1.5em;  border-bottom: 1px solid {border}; padding-bottom: .2em; }}
h3 {{ font-size: 1.25em; }}
h4 {{ font-size: 1em;    font-weight: 700; }}
p {{ margin: .8em 0; }}
a {{ color: {link}; text-decoration: none; }}
a:hover {{ text-decoration: underline; }}
ul, ol {{ margin: .5em 0 .5em 1.8em; }}
li {{ margin: .25em 0; }}
li > ul, li > ol {{ margin: .1em 0 .1em 1.2em; }}
blockquote {{
    border-left: 4px solid {blockquote_border};
    color: {blockquote_fg};
    background: {code_bg};
    padding: .4em 1em;
    margin: 1em 0;
    border-radius: 0 6px 6px 0;
}}
pre {{
    background: {code_bg};
    border: 1px solid {border};
    border-radius: 8px;
    padding: 1em 1.2em;
    overflow-x: auto;
    margin: 1em 0;
}}
code {{
    font-family: 'Cascadia Code', 'Consolas', 'Fira Code', 'Monaco', monospace;
    font-size: .875em;
}}
p > code, li > code, td > code {{
    background: {code_bg};
    color: {inline_code_fg};
    padding: .1em .4em;
    border-radius: 4px;
    border: 1px solid {border};
}}
table {{
    border-collapse: collapse;
    width: 100%;
    margin: 1.2em 0;
    font-size: .95em;
}}
th, td {{
    border: 1px solid {border};
    padding: .5em .9em;
    text-align: left;
}}
th {{ background: {th_bg}; font-weight: 600; }}
tr:nth-child(even) td {{ background: {tr_even}; }}
img {{ max-width: 100%; height: auto; border-radius: 4px; }}
hr {{ border: none; border-top: 2px solid {border}; margin: 2em 0; }}
del {{ color: {muted}; }}
mark {{ background: #fde68a; color: #1e293b; padding: 0 3px; border-radius: 2px; }}
.mermaid {{ text-align: center; margin: 1.5em 0; }}
.katex-display {{ overflow-x: auto; overflow-y: hidden; }}
</style>
</head>
<body>
{content}
<script>
(function () {{
    // Promote mermaid fenced blocks to Mermaid divs BEFORE highlight.js runs
    document.querySelectorAll('pre code.language-mermaid').forEach(function (el) {{
        var div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = el.textContent;
        el.closest('pre').replaceWith(div);
    }});

    // Syntax-highlight all remaining code blocks
    document.querySelectorAll('pre code').forEach(function (el) {{
        hljs.highlightElement(el);
    }});

    // Initialise Mermaid
    if (typeof mermaid !== 'undefined') {{
        mermaid.initialize({{
            startOnLoad: true,
            theme: '{mermaid_theme}',
            securityLevel: 'loose'
        }});
    }}
}})();
</script>
</body>
</html>
"""

# Theme colour palettes
_LIGHT = dict(
    bg="#ffffff", fg="#1e293b", heading_fg="#0f172a",
    link="#2563eb", code_bg="#f8fafc", inline_code_fg="#e11d48",
    border="#e2e8f0", blockquote_border="#94a3b8", blockquote_fg="#64748b",
    th_bg="#f1f5f9", tr_even="#f8fafc", muted="#94a3b8",
    hljs_theme="github", mermaid_theme="default",
)
_DARK = dict(
    bg="#0f172a", fg="#e2e8f0", heading_fg="#f1f5f9",
    link="#60a5fa", code_bg="#1e293b", inline_code_fg="#fb7185",
    border="#334155", blockquote_border="#60a5fa", blockquote_fg="#94a3b8",
    th_bg="#1e293b", tr_even="#162032", muted="#475569",
    hljs_theme="github-dark", mermaid_theme="dark",
)

_MD_EXTENSIONS = [
    "tables", "fenced_code", "footnotes",
    "attr_list", "def_list", "abbr", "meta",
    "nl2br", "sane_lists",
    TocExtension(permalink=True),
]


def render_html(text: str, theme: str) -> str:
    """Convert raw markdown to a complete, styled HTML page."""
    try:
        parser = md_lib.Markdown(extensions=_MD_EXTENSIONS)
        body = parser.convert(text)
    except Exception as exc:
        body = f'<pre style="color:red">Render error: {exc}</pre>'
    palette = _DARK if theme == "dark" else _LIGHT
    return _HTML.format(content=body, **palette)


# ─── Markdown Syntax Highlighter ─────────────────────────────────────────────

class MarkdownHighlighter(QSyntaxHighlighter):
    """Applies colour to raw Markdown text inside the editor."""

    def __init__(self, document, theme: str = "light"):
        super().__init__(document)
        self._theme = theme
        self._rules: list[tuple[QRegularExpression, QTextCharFormat]] = []
        self._compile()

    def set_theme(self, theme: str) -> None:
        self._theme = theme
        self._compile()
        self.rehighlight()

    # ------------------------------------------------------------------
    def _fmt(self, *, color=None, bold=False, italic=False,
              strike=False, underline=False, bg=None, mono=False
              ) -> QTextCharFormat:
        f = QTextCharFormat()
        if color:
            f.setForeground(QColor(color))
        if bold:
            f.setFontWeight(QFont.Weight.Bold)
        if italic:
            f.setFontItalic(True)
        if strike:
            f.setFontStrikeOut(True)
        if underline:
            f.setFontUnderline(True)
        if bg:
            f.setBackground(QColor(bg))
        if mono:
            f.setFontFamily("Consolas")
        return f

    def _compile(self) -> None:
        d = self._theme == "dark"
        self._rules = []

        def add(pattern: str, **kw):
            self._rules.append((QRegularExpression(pattern), self._fmt(**kw)))

        # Fenced code fence markers  (```lang or ~~~)
        add(r"^```.*$|^~~~.*$",
            color="#64748b" if not d else "#475569", mono=True)

        # Headings — full line
        add(r"^#{1,6}\s.+$",
            color="#2563eb" if not d else "#60a5fa", bold=True)

        # Horizontal rule
        add(r"^[-*_]{3,}\s*$", color="#94a3b8")

        # Blockquote
        add(r"^>\s.*$",
            color="#64748b" if not d else "#94a3b8", italic=True)

        # Bold + italic  (*** or ___)
        add(r"\*{3}[^*\n]+\*{3}|_{3}[^_\n]+_{3}",
            color="#7c3aed" if not d else "#a78bfa", bold=True, italic=True)

        # Bold  (** or __)
        add(r"\*{2}[^*\n]+\*{2}|_{2}[^_\n]+_{2}",
            color="#1e40af" if not d else "#93c5fd", bold=True)

        # Italic  (* or _) — simple single
        add(r"\*[^*\n]+\*|(?<![_])_[^_\n]+_(?![_])", italic=True)

        # Strikethrough
        add(r"~~[^~\n]+~~",
            color="#94a3b8", strike=True)

        # Inline code
        add(r"`[^`\n]+`",
            color="#e11d48" if not d else "#fb7185",
            bg="#f1f5f9" if not d else "#1e293b", mono=True)

        # Images (before links so the ! is captured)
        add(r"!\[[^\]]*\]\([^\)\n]*\)",
            color="#7c3aed" if not d else "#a78bfa")

        # Links
        add(r"\[[^\]\n]+\]\([^\)\n]+\)",
            color="#2563eb" if not d else "#60a5fa", underline=True)

        # List markers  (-, *, +, or numbered)
        add(r"^[\t ]*[-*+]\s|^[\t ]*\d+[.)]\s",
            color="#059669" if not d else "#34d399", bold=True)

        # HTML tags
        add(r"<[^>\n]+>", color="#64748b" if not d else "#94a3b8")

        # Math delimiters ($$...$$  or  $...$)
        add(r"\$\$[^\$\n]*\$\$|\$[^\$\n]+\$",
            color="#d97706" if not d else "#fbbf24")

        # Footnote / attribute references
        add(r"\[\^[^\]\n]+\]",
            color="#64748b" if not d else "#94a3b8")

    def highlightBlock(self, text: str) -> None:
        for pattern, fmt in self._rules:
            it = pattern.globalMatch(text)
            while it.hasNext():
                m = it.next()
                self.setFormat(m.capturedStart(), m.capturedLength(), fmt)


# ─── Find & Replace Bar ──────────────────────────────────────────────────────

class FindReplaceBar(QFrame):
    def __init__(self, editor: QPlainTextEdit, parent=None):
        super().__init__(parent)
        self.editor = editor
        self.setFrameShape(QFrame.Shape.StyledPanel)
        self._build()

    def _build(self) -> None:
        row = QHBoxLayout(self)
        row.setContentsMargins(8, 4, 8, 4)
        row.setSpacing(6)

        row.addWidget(QLabel("Find:"))
        self.find_edit = QLineEdit()
        self.find_edit.setPlaceholderText("Search text…")
        self.find_edit.returnPressed.connect(self.find_next)
        row.addWidget(self.find_edit)

        self.case_cb = QCheckBox("Aa")
        self.case_cb.setToolTip("Case-sensitive")
        row.addWidget(self.case_cb)

        self.regex_cb = QCheckBox(".*")
        self.regex_cb.setToolTip("Regular expression")
        row.addWidget(self.regex_cb)

        btn_prev = QPushButton("▲")
        btn_prev.setToolTip("Previous match")
        btn_prev.setFixedWidth(30)
        btn_prev.clicked.connect(self.find_prev)
        row.addWidget(btn_prev)

        btn_next = QPushButton("▼")
        btn_next.setToolTip("Next match")
        btn_next.setFixedWidth(30)
        btn_next.clicked.connect(self.find_next)
        row.addWidget(btn_next)

        row.addWidget(QLabel("Replace:"))
        self.replace_edit = QLineEdit()
        self.replace_edit.setPlaceholderText("Replacement…")
        row.addWidget(self.replace_edit)

        btn_one = QPushButton("Replace")
        btn_one.clicked.connect(self.replace_one)
        row.addWidget(btn_one)

        btn_all = QPushButton("All")
        btn_all.setToolTip("Replace all occurrences")
        btn_all.clicked.connect(self.replace_all)
        row.addWidget(btn_all)

        btn_close = QPushButton("✕")
        btn_close.setFixedWidth(28)
        btn_close.clicked.connect(self.hide)
        row.addWidget(btn_close)

    # ------------------------------------------------------------------
    def _flags(self, backward: bool = False) -> QTextDocument.FindFlags:
        flags = QTextDocument.FindFlags()
        if self.case_cb.isChecked():
            flags |= QTextDocument.FindFlag.FindCaseSensitively
        if backward:
            flags |= QTextDocument.FindFlag.FindBackward
        return flags

    def _find(self, backward: bool = False) -> bool:
        term = self.find_edit.text()
        if not term:
            return False
        flags = self._flags(backward)
        found = self.editor.find(term, flags)
        if not found:
            # Wrap around to the other end
            cur = self.editor.textCursor()
            op = QTextCursor.MoveOperation.End if backward else QTextCursor.MoveOperation.Start
            cur.movePosition(op)
            self.editor.setTextCursor(cur)
            found = self.editor.find(term, flags)
        return found

    def find_next(self) -> None:
        self._find(backward=False)

    def find_prev(self) -> None:
        self._find(backward=True)

    def replace_one(self) -> None:
        cur = self.editor.textCursor()
        term = self.find_edit.text()
        if cur.hasSelection():
            sel = cur.selectedText()
            match = (
                sel == term if self.case_cb.isChecked()
                else sel.lower() == term.lower()
            )
            if match:
                cur.insertText(self.replace_edit.text())
        self.find_next()

    def replace_all(self) -> None:
        term = self.find_edit.text()
        replacement = self.replace_edit.text()
        if not term:
            return
        content = self.editor.toPlainText()
        re_flags = 0 if self.case_cb.isChecked() else re.IGNORECASE
        if self.regex_cb.isChecked():
            new_content, count = re.subn(term, replacement, content, flags=re_flags)
        else:
            new_content, count = re.subn(
                re.escape(term), replacement, content, flags=re_flags
            )
        if count:
            cur = self.editor.textCursor()
            cur.select(QTextCursor.SelectionType.Document)
            cur.insertText(new_content)


# ─── Editor Panel ────────────────────────────────────────────────────────────

class EditorPanel(QWidget):
    """Left half of the split view: plain-text markdown editor + find bar."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build()

    def _build(self) -> None:
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self.editor = QPlainTextEdit()
        font = QFont("Consolas", 11)
        font.setStyleHint(QFont.StyleHint.Monospace)
        self.editor.setFont(font)
        self.editor.setTabStopDistance(32)
        self.editor.setLineWrapMode(QPlainTextEdit.LineWrapMode.WidgetWidth)
        self.editor.setPlaceholderText(
            "Start writing Markdown here…\n\n"
            "Tip: Ctrl+S to save · Ctrl+F to find · Ctrl+Shift+E to export PDF"
        )
        layout.addWidget(self.editor)

        self.highlighter = MarkdownHighlighter(self.editor.document(), "light")

        self.find_bar = FindReplaceBar(self.editor)
        self.find_bar.hide()
        layout.addWidget(self.find_bar)

    # ------------------------------------------------------------------
    def set_theme(self, theme: str) -> None:
        self.highlighter.set_theme(theme)
        dark = theme == "dark"
        self.editor.setStyleSheet(
            "QPlainTextEdit {"
            f"  background: {'#0f172a' if dark else '#ffffff'};"
            f"  color: {'#e2e8f0' if dark else '#1e293b'};"
            "  border: none;"
            "  selection-background-color: #2563eb;"
            "  selection-color: #ffffff;"
            "}"
        )

    def toggle_find(self) -> None:
        if self.find_bar.isVisible():
            self.find_bar.hide()
            self.editor.setFocus()
        else:
            self.find_bar.show()
            self.find_bar.find_edit.setFocus()
            self.find_bar.find_edit.selectAll()

    def get_text(self) -> str:
        return self.editor.toPlainText()

    def set_text(self, text: str) -> None:
        self.editor.setPlainText(text)

    def is_modified(self) -> bool:
        return self.editor.document().isModified()

    def set_modified(self, value: bool) -> None:
        self.editor.document().setModified(value)


# ─── Main Window ─────────────────────────────────────────────────────────────

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self._current_file: Path | None = None
        self._theme: str = "light"
        self._pdf_path: str = ""

        # Debounce preview refreshes so we don't re-render on every keystroke
        self._preview_timer = QTimer(singleShot=True, interval=350)
        self._preview_timer.timeout.connect(self._refresh_preview)

        self._build_ui()
        self._build_menu()
        self._build_toolbar()
        self._apply_theme()
        self._update_title()
        self._refresh_preview()

    # ── UI Construction ────────────────────────────────────────────────

    def _build_ui(self) -> None:
        self.setWindowTitle("Markdown Editor")
        self.resize(1440, 900)

        root = QWidget()
        self.setCentralWidget(root)
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)

        self.splitter = QSplitter(Qt.Orientation.Horizontal)
        root_layout.addWidget(self.splitter)

        # ── Sidebar: file browser ──
        self._sidebar = QWidget()
        sb_layout = QVBoxLayout(self._sidebar)
        sb_layout.setContentsMargins(0, 0, 0, 0)
        sb_layout.setSpacing(0)

        self._sidebar_header = QLabel("  Files")
        self._sidebar_header.setFixedHeight(30)
        sb_layout.addWidget(self._sidebar_header)

        self._fs_model = QFileSystemModel()
        self._fs_model.setRootPath(QDir.homePath())

        self._file_tree = QTreeView()
        self._file_tree.setModel(self._fs_model)
        self._file_tree.setRootIndex(self._fs_model.index(QDir.homePath()))
        self._file_tree.setHeaderHidden(True)
        # Show only the name column; hide size / type / date
        for col in (1, 2, 3):
            self._file_tree.hideColumn(col)
        self._file_tree.setAnimated(True)
        self._file_tree.doubleClicked.connect(self._tree_open)
        sb_layout.addWidget(self._file_tree)

        self.splitter.addWidget(self._sidebar)
        self._sidebar.setMinimumWidth(160)

        # ── Editor panel ──
        self._editor_panel = EditorPanel()
        self._editor_panel.editor.textChanged.connect(self._on_text_changed)
        self.splitter.addWidget(self._editor_panel)

        # ── Preview panel ──
        self._preview_container = QWidget()
        pv_layout = QVBoxLayout(self._preview_container)
        pv_layout.setContentsMargins(0, 0, 0, 0)
        pv_layout.setSpacing(0)

        self._preview = QWebEngineView()
        self._preview.settings().setAttribute(
            QWebEngineSettings.WebAttribute.LocalContentCanAccessRemoteUrls, True
        )
        self._preview.page().pdfPrintingFinished.connect(self._on_pdf_done)
        pv_layout.addWidget(self._preview)
        self.splitter.addWidget(self._preview_container)

        # Starting proportions: sidebar 15 %, editor 42 %, preview 43 %
        self.splitter.setSizes([220, 580, 640])

        self.setStatusBar(QStatusBar())
        self._update_status()

    def _build_menu(self) -> None:
        mb = self.menuBar()

        # ── File ──
        file_m = mb.addMenu("&File")
        self._add_action(file_m, "&New",           self.action_new,
                         QKeySequence.StandardKey.New)
        self._add_action(file_m, "&Open File…",    self.action_open,
                         QKeySequence.StandardKey.Open)
        self._add_action(file_m, "Open &Folder…",  self.action_open_folder,
                         QKeySequence("Ctrl+Shift+O"))
        file_m.addSeparator()
        self._add_action(file_m, "&Save",          self.action_save,
                         QKeySequence.StandardKey.Save)
        self._add_action(file_m, "Save &As…",      self.action_save_as,
                         QKeySequence.StandardKey.SaveAs)
        file_m.addSeparator()
        self._add_action(file_m, "Export &PDF…",   self.action_export_pdf,
                         QKeySequence("Ctrl+Shift+E"))
        file_m.addSeparator()
        self._add_action(file_m, "&Quit",          self.close,
                         QKeySequence.StandardKey.Quit)

        # ── Edit ──
        edit_m = mb.addMenu("&Edit")
        self._add_action(edit_m, "&Undo",
                         self._editor_panel.editor.undo,
                         QKeySequence.StandardKey.Undo)
        self._add_action(edit_m, "&Redo",
                         self._editor_panel.editor.redo,
                         QKeySequence.StandardKey.Redo)
        edit_m.addSeparator()
        self._add_action(edit_m, "Cu&t",
                         self._editor_panel.editor.cut,
                         QKeySequence.StandardKey.Cut)
        self._add_action(edit_m, "&Copy",
                         self._editor_panel.editor.copy,
                         QKeySequence.StandardKey.Copy)
        self._add_action(edit_m, "&Paste",
                         self._editor_panel.editor.paste,
                         QKeySequence.StandardKey.Paste)
        edit_m.addSeparator()
        self._add_action(edit_m, "&Find && Replace",
                         self._editor_panel.toggle_find,
                         QKeySequence.StandardKey.Find)

        # ── View ──
        view_m = mb.addMenu("&View")
        self._sidebar_act = QAction("&File Browser", self, checkable=True, checked=True)
        self._sidebar_act.setShortcut(QKeySequence("Ctrl+B"))
        self._sidebar_act.toggled.connect(self._sidebar.setVisible)
        view_m.addAction(self._sidebar_act)

        self._preview_act = QAction("&Preview Panel", self, checkable=True, checked=True)
        self._preview_act.setShortcut(QKeySequence("Ctrl+Shift+P"))
        self._preview_act.toggled.connect(self._preview_container.setVisible)
        view_m.addAction(self._preview_act)

        view_m.addSeparator()
        self._add_action(view_m, "Toggle &Dark Mode",
                         self.toggle_theme, QKeySequence("Ctrl+Shift+D"))

    def _build_toolbar(self) -> None:
        tb: QToolBar = self.addToolBar("Main")
        tb.setMovable(False)
        tb.setObjectName("main_toolbar")

        for label, slot in [
            ("New",         self.action_new),
            ("Open",        self.action_open),
            ("Open Folder", self.action_open_folder),
        ]:
            tb.addAction(label, slot)
        tb.addSeparator()
        tb.addAction("Save", self.action_save)
        tb.addSeparator()
        tb.addAction("Export PDF", self.action_export_pdf)
        tb.addSeparator()
        tb.addAction("Find & Replace", self._editor_panel.toggle_find)
        tb.addSeparator()

        self._theme_btn = QPushButton("🌙 Dark")
        self._theme_btn.setFlat(True)
        self._theme_btn.setToolTip("Toggle dark / light mode  (Ctrl+Shift+D)")
        self._theme_btn.clicked.connect(self.toggle_theme)
        tb.addWidget(self._theme_btn)

    @staticmethod
    def _add_action(menu, label: str, slot, shortcut=None) -> QAction:
        act = QAction(label)
        if shortcut:
            act.setShortcut(shortcut)
        act.triggered.connect(slot)
        menu.addAction(act)
        return act

    # ── Theme ──────────────────────────────────────────────────────────

    def toggle_theme(self) -> None:
        self._theme = "light" if self._theme == "dark" else "dark"
        self._apply_theme()

    def _apply_theme(self) -> None:
        dark = self._theme == "dark"
        self._editor_panel.set_theme(self._theme)

        if dark:
            qs = """
            QMainWindow, QWidget       { background:#0f172a; color:#e2e8f0; }
            QMenuBar                   { background:#1e293b; color:#e2e8f0; }
            QMenuBar::item:selected    { background:#334155; }
            QMenu                      { background:#1e293b; color:#e2e8f0;
                                         border:1px solid #334155; }
            QMenu::item:selected       { background:#334155; }
            QToolBar                   { background:#1e293b; border:none;
                                         border-bottom:1px solid #334155; padding:2px; }
            QToolButton                { color:#e2e8f0; padding:3px 6px; border-radius:4px; }
            QToolButton:hover          { background:#334155; }
            QTreeView                  { background:#0f172a; color:#e2e8f0; border:none; }
            QTreeView::item:hover      { background:#1e293b; }
            QTreeView::item:selected   { background:#2563eb; color:#ffffff; }
            QHeaderView::section       { background:#1e293b; color:#94a3b8; border:none; }
            QSplitter::handle          { background:#334155; }
            QLabel                     { color:#e2e8f0; }
            QLineEdit                  { background:#1e293b; color:#e2e8f0;
                                         border:1px solid #334155; border-radius:4px;
                                         padding:2px 6px; }
            QPushButton                { background:#1e293b; color:#e2e8f0;
                                         border:1px solid #334155; border-radius:4px;
                                         padding:3px 10px; }
            QPushButton:hover          { background:#334155; }
            QCheckBox                  { color:#e2e8f0; }
            QStatusBar                 { background:#1e293b; color:#94a3b8; }
            QFrame                     { border:none; }
            """
            self._theme_btn.setText("☀  Light")
        else:
            qs = """
            QMainWindow, QWidget       { background:#f8fafc; color:#1e293b; }
            QMenuBar                   { background:#f1f5f9; color:#1e293b; }
            QMenuBar::item:selected    { background:#e2e8f0; }
            QMenu                      { background:#ffffff; color:#1e293b;
                                         border:1px solid #e2e8f0; }
            QMenu::item:selected       { background:#e2e8f0; }
            QToolBar                   { background:#f1f5f9; border:none;
                                         border-bottom:1px solid #e2e8f0; padding:2px; }
            QToolButton                { color:#1e293b; padding:3px 6px; border-radius:4px; }
            QToolButton:hover          { background:#e2e8f0; }
            QTreeView                  { background:#f8fafc; color:#1e293b; border:none; }
            QTreeView::item:hover      { background:#e2e8f0; }
            QTreeView::item:selected   { background:#2563eb; color:#ffffff; }
            QHeaderView::section       { background:#f1f5f9; color:#64748b; border:none; }
            QSplitter::handle          { background:#e2e8f0; }
            QLabel                     { color:#1e293b; }
            QLineEdit                  { background:#ffffff; color:#1e293b;
                                         border:1px solid #e2e8f0; border-radius:4px;
                                         padding:2px 6px; }
            QPushButton                { background:#f1f5f9; color:#1e293b;
                                         border:1px solid #e2e8f0; border-radius:4px;
                                         padding:3px 10px; }
            QPushButton:hover          { background:#e2e8f0; }
            QCheckBox                  { color:#1e293b; }
            QStatusBar                 { background:#f1f5f9; color:#64748b; }
            QFrame                     { border:none; }
            """
            self._theme_btn.setText("🌙 Dark")

        QApplication.instance().setStyleSheet(qs)
        self._refresh_preview()

    # ── File operations ────────────────────────────────────────────────

    def _confirm_discard(self) -> bool:
        """Return True if it is safe to discard unsaved changes."""
        if not self._editor_panel.is_modified():
            return True
        reply = QMessageBox.question(
            self, "Unsaved changes",
            "You have unsaved changes. Discard them?",
            QMessageBox.StandardButton.Discard | QMessageBox.StandardButton.Cancel,
        )
        return reply == QMessageBox.StandardButton.Discard

    def action_new(self) -> None:
        if not self._confirm_discard():
            return
        self._current_file = None
        self._editor_panel.set_text("")
        self._editor_panel.set_modified(False)
        self._update_title()
        self._refresh_preview()

    def action_open(self) -> None:
        if not self._confirm_discard():
            return
        path, _ = QFileDialog.getOpenFileName(
            self, "Open Markdown File", str(Path.home()),
            "Markdown Files (*.md *.markdown *.txt);;All Files (*)"
        )
        if path:
            self._load_file(Path(path))

    def action_open_folder(self) -> None:
        folder = QFileDialog.getExistingDirectory(
            self, "Open Folder", str(Path.home())
        )
        if folder:
            self._fs_model.setRootPath(folder)
            self._file_tree.setRootIndex(self._fs_model.index(folder))
            if not self._sidebar.isVisible():
                self._sidebar.show()
                self._sidebar_act.setChecked(True)

    def action_save(self) -> None:
        if self._current_file:
            self._save_to(self._current_file)
        else:
            self.action_save_as()

    def action_save_as(self) -> None:
        default = str(self._current_file or Path.home() / "untitled.md")
        path, _ = QFileDialog.getSaveFileName(
            self, "Save As", default,
            "Markdown Files (*.md *.markdown);;All Files (*)"
        )
        if path:
            self._save_to(Path(path))

    def action_export_pdf(self) -> None:
        default = str(
            (self._current_file.with_suffix(".pdf") if self._current_file
             else Path.home() / "document.pdf")
        )
        path, _ = QFileDialog.getSaveFileName(
            self, "Export PDF", default, "PDF Files (*.pdf)"
        )
        if path:
            self._pdf_path = path
            self.statusBar().showMessage("Generating PDF…")
            self._preview.page().printToPdf(path)

    def _load_file(self, path: Path) -> None:
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as exc:
            QMessageBox.critical(self, "Error", f"Could not read file:\n{exc}")
            return
        self._current_file = path
        self._editor_panel.set_text(text)
        self._editor_panel.set_modified(False)
        self._update_title()
        self.statusBar().showMessage(f"Opened: {path}", 4000)

    def _save_to(self, path: Path) -> None:
        try:
            path.write_text(self._editor_panel.get_text(), encoding="utf-8")
        except Exception as exc:
            QMessageBox.critical(self, "Error", f"Could not save file:\n{exc}")
            return
        self._current_file = path
        self._editor_panel.set_modified(False)
        self._update_title()
        self.statusBar().showMessage(f"Saved: {path}", 4000)

    # ── File browser ───────────────────────────────────────────────────

    def _tree_open(self, index) -> None:
        path = Path(self._fs_model.filePath(index))
        if path.is_file() and path.suffix.lower() in (".md", ".markdown", ".txt"):
            if self._confirm_discard():
                self._load_file(path)

    # ── Preview ────────────────────────────────────────────────────────

    def _on_text_changed(self) -> None:
        self._update_status()
        self._preview_timer.start()

    def _refresh_preview(self) -> None:
        html = render_html(self._editor_panel.get_text(), self._theme)
        self._preview.setHtml(html, QUrl("about:blank"))

    def _on_pdf_done(self, path: str, success: bool) -> None:
        if success:
            self.statusBar().showMessage(f"PDF saved: {path}", 6000)
        else:
            QMessageBox.critical(self, "PDF Export Failed",
                                 "The PDF could not be generated.")

    # ── Status & title ─────────────────────────────────────────────────

    def _update_title(self) -> None:
        name = self._current_file.name if self._current_file else "Untitled"
        mod = " •" if self._editor_panel.is_modified() else ""
        self.setWindowTitle(f"{name}{mod} — Markdown Editor")

    def _update_status(self) -> None:
        text = self._editor_panel.get_text()
        words = len(text.split()) if text.strip() else 0
        chars = len(text)
        lines = text.count("\n") + 1 if text else 0
        self.statusBar().showMessage(
            f"Lines: {lines}   Words: {words}   Characters: {chars}"
        )
        self._update_title()

    # ── Window close guard ─────────────────────────────────────────────

    def closeEvent(self, event) -> None:
        if self._confirm_discard():
            event.accept()
        else:
            event.ignore()


# ─── Entry Point ─────────────────────────────────────────────────────────────

def main() -> None:
    # Required before QApplication on some Windows configurations
    os.environ.setdefault("QTWEBENGINE_CHROMIUM_FLAGS", "--disable-gpu-sandbox")

    app = QApplication(sys.argv)
    app.setApplicationName("Markdown Editor")
    app.setOrganizationName("LocalTools")

    win = MainWindow()
    win.show()

    # If a file is passed on the command line, open it
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        if p.is_file():
            win._load_file(p)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
