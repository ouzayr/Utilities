package com.ouzayr.tododiary.ink

import com.ouzayr.tododiary.model.InkDocument

/**
 * Boundary interface for everything ink. UI and data layers only ever see this
 * interface plus [InkDocument]; the concrete engine (currently [InkView], a
 * hand-rolled low-latency canvas with motion prediction) can be swapped for the
 * Jetpack Ink API without touching the rest of the app — see CLAUDE.md §3.
 */
interface InkEngine {
    /** Replace all content from a portable ink JSON document. */
    fun load(document: InkDocument)

    /** Snapshot the current content as a portable ink document. */
    fun snapshot(): InkDocument

    fun undo()
    fun redo()
    fun canUndo(): Boolean
    fun canRedo(): Boolean
    fun clearAll()

    /** Pen configuration. [pressureGamma] < 1 flattens, > 1 exaggerates pressure. */
    fun setPen(colorHex: String, baseWidthPx: Float, pressureGamma: Float)

    /** When true a finger can draw too (palm rejection off). Stylus always draws. */
    fun setFingerDrawing(enabled: Boolean)

    /** Force eraser mode from the toolbar (stylus button / inverted pen also erase). */
    fun setEraserMode(enabled: Boolean)

    /** Called after every committed change (stroke finished, erase, undo, ...). */
    fun setOnChanged(listener: (() -> Unit)?)
}
