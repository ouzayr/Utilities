package com.ouzayr.tododiary.ink

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.MotionEvent
import android.view.View
import androidx.input.motionprediction.MotionEventPredictor
import com.ouzayr.tododiary.model.InkDocument
import com.ouzayr.tododiary.model.InkStroke
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Low-latency handwriting surface.
 *
 * - Stylus draws; finger pans/scrolls (events are not consumed) unless finger
 *   drawing is explicitly enabled in settings.
 * - Stylus side button, an inverted pen (TOOL_TYPE_ERASER) or the toolbar
 *   toggle erase whole strokes.
 * - Committed strokes are cached in a bitmap so onDraw only paints the wet
 *   stroke; a MotionEventPredictor tail hides input latency.
 *
 * This class is the only place that touches raw MotionEvents; everything else
 * talks to [InkEngine] / [InkDocument].
 */
class InkView(context: Context) : View(context), InkEngine {

    private val strokes = ArrayList<InkStroke>()

    private sealed interface Op
    private class AddOp(val stroke: InkStroke) : Op
    private class EraseOp(val erased: List<InkStroke>) : Op
    private class ClearOp(val erased: List<InkStroke>) : Op

    private val undoStack = ArrayDeque<Op>()
    private val redoStack = ArrayDeque<Op>()

    // Wet (in-progress) stroke as flat x,y,pressure triplets.
    private val wetPoints = ArrayList<Float>(512)
    private var predictedTail: FloatArray? = null
    private var activePointerId = -1
    private var erasing = false

    private var penColorHex = "#1A237E"
    private var penColor = Color.parseColor(penColorHex)
    private var baseWidth = 4f
    private var pressureGamma = 1.0f
    private var fingerDrawing = false
    private var eraserToggled = false

    private var cache: Bitmap? = null
    private var cacheCanvas: Canvas? = null
    private var pendingDoc: InkDocument? = null

    private var onChanged: (() -> Unit)? = null

    /** Notified whenever undo/redo availability may have changed. */
    var onStacksChanged: (() -> Unit)? = null

    private val predictor: MotionEventPredictor = MotionEventPredictor.newInstance(this)

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    init {
        setBackgroundColor(Color.TRANSPARENT)
    }

    // ---- InkEngine ----

    override fun load(document: InkDocument) {
        if (width == 0) {
            pendingDoc = document
            return
        }
        applyDocument(document)
    }

    override fun snapshot(): InkDocument = InkDocument(width.toFloat(), strokes.toList())

    override fun undo() {
        val op = undoStack.removeLastOrNull() ?: return
        when (op) {
            is AddOp -> strokes.remove(op.stroke)
            is EraseOp -> strokes.addAll(op.erased)
            is ClearOp -> strokes.addAll(op.erased)
        }
        redoStack.addLast(op)
        rebuildCache()
        notifyChanged()
    }

    override fun redo() {
        val op = redoStack.removeLastOrNull() ?: return
        when (op) {
            is AddOp -> strokes.add(op.stroke)
            is EraseOp -> strokes.removeAll(op.erased.toSet())
            is ClearOp -> strokes.removeAll(op.erased.toSet())
        }
        undoStack.addLast(op)
        rebuildCache()
        notifyChanged()
    }

    override fun canUndo(): Boolean = undoStack.isNotEmpty()
    override fun canRedo(): Boolean = redoStack.isNotEmpty()

    override fun clearAll() {
        if (strokes.isEmpty()) return
        undoStack.addLast(ClearOp(strokes.toList()))
        redoStack.clear()
        strokes.clear()
        rebuildCache()
        notifyChanged()
    }

    override fun setPen(colorHex: String, baseWidthPx: Float, pressureGamma: Float) {
        this.penColorHex = colorHex
        this.penColor = runCatching { Color.parseColor(colorHex) }.getOrDefault(Color.BLACK)
        this.baseWidth = baseWidthPx
        this.pressureGamma = pressureGamma
    }

    override fun setFingerDrawing(enabled: Boolean) {
        fingerDrawing = enabled
    }

    override fun setEraserMode(enabled: Boolean) {
        eraserToggled = enabled
    }

    override fun setOnChanged(listener: (() -> Unit)?) {
        onChanged = listener
    }

    private fun notifyChanged() {
        onStacksChanged?.invoke()
        onChanged?.invoke()
    }

    // ---- geometry / rendering ----

    private fun applyDocument(document: InkDocument) {
        strokes.clear()
        undoStack.clear()
        redoStack.clear()
        val scale = if (document.canvasWidth > 0f) width / document.canvasWidth else 1f
        for (s in document.strokes) {
            if (scale == 1f) {
                strokes.add(s)
            } else {
                val pts = FloatArray(s.points.size)
                for (i in s.points.indices) {
                    // x and y scale together to preserve aspect; pressure untouched
                    pts[i] = if (i % 3 == 2) s.points[i] else s.points[i] * scale
                }
                strokes.add(InkStroke(s.color, s.width * scale, pts))
            }
        }
        rebuildCache()
        onStacksChanged?.invoke()
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) return
        cache = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
            cacheCanvas = Canvas(it)
        }
        val pending = pendingDoc
        pendingDoc = null
        if (pending != null) {
            applyDocument(pending)
        } else {
            rebuildCache()
        }
    }

    private fun rebuildCache() {
        val canvas = cacheCanvas ?: return
        canvas.drawColor(Color.TRANSPARENT, android.graphics.PorterDuff.Mode.CLEAR)
        for (s in strokes) drawStroke(canvas, s)
        invalidate()
    }

    private fun widthFor(strokeBaseWidth: Float, pressure: Float): Float {
        val p = min(1f, max(0.05f, pressure)).pow(pressureGamma)
        return strokeBaseWidth * (0.35f + 0.85f * p)
    }

    private fun drawStroke(canvas: Canvas, s: InkStroke) {
        paint.color = runCatching { Color.parseColor(s.color) }.getOrDefault(Color.BLACK)
        val n = s.pointCount
        if (n == 0) return
        if (n == 1) {
            paint.strokeWidth = widthFor(s.width, s.pressure(0))
            canvas.drawPoint(s.x(0), s.y(0), paint)
            return
        }
        for (i in 0 until n - 1) {
            paint.strokeWidth = widthFor(s.width, (s.pressure(i) + s.pressure(i + 1)) / 2f)
            canvas.drawLine(s.x(i), s.y(i), s.x(i + 1), s.y(i + 1), paint)
        }
    }

    private fun drawFlatPoints(canvas: Canvas, pts: List<Float>, color: Int, alpha: Int = 255) {
        val n = pts.size / 3
        if (n == 0) return
        paint.color = color
        paint.alpha = alpha
        if (n == 1) {
            paint.strokeWidth = widthFor(baseWidth, pts[2])
            canvas.drawPoint(pts[0], pts[1], paint)
        } else {
            for (i in 0 until n - 1) {
                paint.strokeWidth = widthFor(baseWidth, (pts[i * 3 + 2] + pts[(i + 1) * 3 + 2]) / 2f)
                canvas.drawLine(pts[i * 3], pts[i * 3 + 1], pts[(i + 1) * 3], pts[(i + 1) * 3 + 1], paint)
            }
        }
        paint.alpha = 255
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        cache?.let { canvas.drawBitmap(it, 0f, 0f, null) }
        if (wetPoints.isNotEmpty() && !erasing) {
            drawFlatPoints(canvas, wetPoints, penColor)
            // Predicted tail: rendered slightly transparent, never committed.
            predictedTail?.let { tail ->
                val bridge = ArrayList<Float>(3 + tail.size)
                val lastBase = wetPoints.size - 3
                bridge.add(wetPoints[lastBase]); bridge.add(wetPoints[lastBase + 1]); bridge.add(wetPoints[lastBase + 2])
                for (v in tail) bridge.add(v)
                drawFlatPoints(canvas, bridge, penColor, alpha = 200)
            }
        }
    }

    // ---- input ----

    private fun isDrawingTool(event: MotionEvent, pointerIndex: Int): Boolean {
        val tool = event.getToolType(pointerIndex)
        return tool == MotionEvent.TOOL_TYPE_STYLUS ||
            tool == MotionEvent.TOOL_TYPE_ERASER ||
            (fingerDrawing && tool == MotionEvent.TOOL_TYPE_FINGER)
    }

    private fun isEraser(event: MotionEvent, pointerIndex: Int): Boolean {
        return eraserToggled ||
            event.getToolType(pointerIndex) == MotionEvent.TOOL_TYPE_ERASER ||
            (event.buttonState and MotionEvent.BUTTON_STYLUS_PRIMARY) != 0
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (!isDrawingTool(event, 0)) return false
                parent?.requestDisallowInterceptTouchEvent(true)
                activePointerId = event.getPointerId(0)
                erasing = isEraser(event, 0)
                wetPoints.clear()
                predictedTail = null
                if (erasing) {
                    eraseAt(event.x, event.y)
                } else {
                    predictor.record(event)
                    wetPoints.add(event.x); wetPoints.add(event.y); wetPoints.add(event.pressure)
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (activePointerId == -1) return false
                val idx = event.findPointerIndex(activePointerId)
                if (idx < 0) return true
                if (erasing) {
                    for (h in 0 until event.historySize) {
                        eraseAt(event.getHistoricalX(idx, h), event.getHistoricalY(idx, h))
                    }
                    eraseAt(event.getX(idx), event.getY(idx))
                } else {
                    predictor.record(event)
                    for (h in 0 until event.historySize) {
                        wetPoints.add(event.getHistoricalX(idx, h))
                        wetPoints.add(event.getHistoricalY(idx, h))
                        wetPoints.add(event.getHistoricalPressure(idx, h))
                    }
                    wetPoints.add(event.getX(idx)); wetPoints.add(event.getY(idx)); wetPoints.add(event.getPressure(idx))
                    predictedTail = predictor.predict()?.let { predicted ->
                        val out = FloatArray(3)
                        out[0] = predicted.x; out[1] = predicted.y; out[2] = predicted.pressure
                        predicted.recycle()
                        out
                    }
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                if (activePointerId == -1) return false
                if (erasing) {
                    finishErase()
                } else {
                    commitWetStroke()
                }
                activePointerId = -1
                erasing = false
                predictedTail = null
                parent?.requestDisallowInterceptTouchEvent(false)
                invalidate()
                return true
            }
        }
        return false
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private fun commitWetStroke() {
        if (wetPoints.isEmpty()) return
        val stroke = InkStroke(penColorHex, baseWidth, wetPoints.toFloatArray())
        wetPoints.clear()
        strokes.add(stroke)
        undoStack.addLast(AddOp(stroke))
        redoStack.clear()
        cacheCanvas?.let { drawStroke(it, stroke) }
        notifyChanged()
    }

    // Whole-stroke erase: strokes intersecting the eraser point are removed
    // together and undone together as one operation.
    private val pendingErased = ArrayList<InkStroke>()

    private fun eraseAt(x: Float, y: Float) {
        val radius = baseWidth * 6f
        val r2 = radius * radius
        var removedAny = false
        val it = strokes.iterator()
        while (it.hasNext()) {
            val s = it.next()
            var hit = false
            for (i in 0 until s.pointCount) {
                val dx = s.x(i) - x
                val dy = s.y(i) - y
                if (dx * dx + dy * dy <= r2) { hit = true; break }
            }
            if (hit) {
                it.remove()
                pendingErased.add(s)
                removedAny = true
            }
        }
        if (removedAny) rebuildCache()
    }

    private fun finishErase() {
        if (pendingErased.isEmpty()) return
        undoStack.addLast(EraseOp(pendingErased.toList()))
        redoStack.clear()
        pendingErased.clear()
        notifyChanged()
    }
}
