package com.ouzayr.tododiary.ink

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.ouzayr.tododiary.model.InkDocument

/**
 * Compose-side handle for one ink surface. Hoist with [rememberInkController]
 * to drive undo/redo/clear from toolbar buttons.
 */
@Stable
class InkController {
    internal var engine: InkEngine? = null

    var canUndo by mutableStateOf(false)
        internal set
    var canRedo by mutableStateOf(false)
        internal set

    /** JSON the surface last emitted; used to ignore Firestore echoes of our own writes. */
    internal var lastEmittedJson: String? = null
    internal var loadedJson: String? = null

    fun undo() = engine?.undo() ?: Unit
    fun redo() = engine?.redo() ?: Unit
    fun clearAll() = engine?.clearAll() ?: Unit

    internal fun refreshStacks() {
        canUndo = engine?.canUndo() ?: false
        canRedo = engine?.canRedo() ?: false
    }
}

@Composable
fun rememberInkController(): InkController = remember { InkController() }

/**
 * A drawing surface bound to a portable ink JSON document.
 *
 * [inkJson] is the authoritative remote content: it is loaded into the surface
 * whenever it changes, except when it is simply Firestore echoing back what
 * this surface just emitted (which would interrupt the pen mid-word).
 * Local edits are emitted through [onInkChanged].
 */
@Composable
fun InkSurface(
    inkJson: String?,
    penColorHex: String,
    penWidthPx: Float,
    pressureGamma: Float,
    fingerDrawing: Boolean,
    eraserMode: Boolean,
    onInkChanged: (String) -> Unit,
    modifier: Modifier = Modifier,
    controller: InkController = rememberInkController(),
) {
    AndroidView(
        modifier = modifier,
        factory = { context ->
            InkView(context).also { view ->
                controller.engine = view
                view.onStacksChanged = { controller.refreshStacks() }
                view.setOnChanged {
                    val json = view.snapshot().toJson()
                    controller.lastEmittedJson = json
                    controller.loadedJson = json
                    onInkChanged(json)
                }
            }
        },
        update = { view ->
            controller.engine = view
            view.setPen(penColorHex, penWidthPx, pressureGamma)
            view.setFingerDrawing(fingerDrawing)
            view.setEraserMode(eraserMode)
            val incoming = inkJson ?: ""
            if (incoming != (controller.loadedJson ?: "") && incoming != controller.lastEmittedJson) {
                view.load(InkDocument.fromJson(incoming))
                controller.loadedJson = incoming
            }
        },
    )
}
