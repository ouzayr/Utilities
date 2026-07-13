package com.ouzayr.tododiary.export

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import com.ouzayr.tododiary.model.DiaryPage
import com.ouzayr.tododiary.model.InkDocument
import com.ouzayr.tododiary.model.InputType
import com.ouzayr.tododiary.model.Task
import com.ouzayr.tododiary.model.TaskStatus
import com.ouzayr.tododiary.util.DateUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import kotlin.math.max
import kotlin.math.min

/**
 * Renders diary pages to an A4 PDF: header, focus ink, task rows (typed text
 * or scaled handwriting) and the notes ink layer. One diary day per PDF page.
 */
object PdfExporter {

    private const val PAGE_W = 595 // A4 @72dpi
    private const val PAGE_H = 842
    private const val MARGIN = 36f

    suspend fun export(
        context: Context,
        pages: List<Triple<LocalDate, DiaryPage, List<Task>>>,
    ): File = withContext(Dispatchers.IO) {
        val doc = PdfDocument()
        pages.forEachIndexed { index, (date, page, tasks) ->
            val info = PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, index + 1).create()
            val pdfPage = doc.startPage(info)
            drawDay(pdfPage.canvas, date, page, tasks)
            doc.finishPage(pdfPage)
        }
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val name = if (pages.size == 1) {
            "tododiary-${DateUtils.format(pages.first().first)}.pdf"
        } else {
            "tododiary-${DateUtils.format(pages.first().first)}-to-${DateUtils.format(pages.last().first)}.pdf"
        }
        val file = File(dir, name)
        FileOutputStream(file).use { doc.writeTo(it) }
        doc.close()
        file
    }

    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(
            Intent.createChooser(intent, "Export PDF").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    private fun drawDay(canvas: Canvas, date: LocalDate, page: DiaryPage, tasks: List<Task>) {
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(26, 35, 126)
            textSize = 18f
            isFakeBoldText = true
        }
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(184, 134, 11)
            textSize = 9f
        }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(32, 34, 46)
            textSize = 12f
        }
        val faintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(70, 85, 96, 128)
            strokeWidth = 0.7f
        }

        var y = MARGIN + 10f
        canvas.drawText(DateUtils.dayHeader(date), MARGIN, y, titlePaint)
        y += 22f

        // Focus
        canvas.drawText("FOCUS", MARGIN, y, labelPaint)
        y += 4f
        val focusInk = InkDocument.fromJson(page.focusInkJson)
        if (!focusInk.isEmpty) {
            y += drawInk(canvas, focusInk, MARGIN, y, PAGE_W - 2 * MARGIN, maxHeight = 60f) + 6f
        } else if (!page.focusText.isNullOrBlank()) {
            y += 14f
            canvas.drawText(page.focusText, MARGIN, y, textPaint)
            y += 8f
        } else {
            y += 18f
        }
        canvas.drawLine(MARGIN, y, PAGE_W - MARGIN, y, faintPaint)
        y += 14f

        // Tasks
        canvas.drawText("TASKS", MARGIN, y, labelPaint)
        y += 6f
        for (task in tasks) {
            if (y > PAGE_H - 220f) break // leave room for notes
            val rowTop = y
            val circleX = MARGIN + 6f
            val circleY = rowTop + 10f
            val circlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 1.2f
                color = Color.rgb(90, 93, 110)
            }
            canvas.drawCircle(circleX, circleY, 5f, circlePaint)
            if (task.status == TaskStatus.DONE) {
                circlePaint.style = Paint.Style.FILL
                canvas.drawCircle(circleX, circleY, 3.2f, circlePaint)
            }

            val contentX = MARGIN + 20f
            val contentW = PAGE_W - MARGIN - contentX
            var rowHeight: Float
            if (task.inputType == InputType.TEXT) {
                val label = task.textContent.orEmpty().ifBlank { "…" }
                canvas.drawText(label, contentX, rowTop + 14f, textPaint)
                if (task.status == TaskStatus.DONE) {
                    val w = min(textPaint.measureText(label), contentW)
                    canvas.drawLine(contentX, rowTop + 10f, contentX + w, rowTop + 10f, textPaint)
                }
                rowHeight = 22f
            } else {
                val ink = InkDocument.fromJson(task.inkJson)
                rowHeight = if (ink.isEmpty) 22f else drawInk(canvas, ink, contentX, rowTop, contentW, maxHeight = 34f) + 6f
                if (task.status == TaskStatus.DONE) {
                    canvas.drawLine(contentX, rowTop + rowHeight / 2f, contentX + contentW * 0.9f, rowTop + rowHeight / 2f - 2f, textPaint)
                }
            }
            if (task.status == TaskStatus.CARRIED && task.carriedToDate != null) {
                canvas.drawText(DateUtils.carriedTag(task.carriedToDate), PAGE_W - MARGIN - 50f, rowTop + 12f, labelPaint)
            }
            y = rowTop + max(rowHeight, 20f)
        }
        y += 8f
        canvas.drawLine(MARGIN, y, PAGE_W - MARGIN, y, faintPaint)
        y += 14f

        // Notes ink
        canvas.drawText("NOTES", MARGIN, y, labelPaint)
        y += 6f
        val notes = InkDocument.fromJson(page.notesInkJson)
        if (!notes.isEmpty) {
            drawInk(canvas, notes, MARGIN, y, PAGE_W - 2 * MARGIN, maxHeight = PAGE_H - MARGIN - y)
        }
    }

    /**
     * Draws an ink document scaled to [targetWidth], clipped to [maxHeight].
     * Returns the drawn height.
     */
    private fun drawInk(
        canvas: Canvas,
        doc: InkDocument,
        left: Float,
        top: Float,
        targetWidth: Float,
        maxHeight: Float,
    ): Float {
        if (doc.isEmpty || doc.canvasWidth <= 0f) return 0f
        val scale = targetWidth / doc.canvasWidth
        var maxY = 0f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        canvas.save()
        canvas.clipRect(left, top, left + targetWidth, top + maxHeight)
        canvas.translate(left, top)
        for (s in doc.strokes) {
            paint.color = runCatching { Color.parseColor(s.color) }.getOrDefault(Color.BLACK)
            val n = s.pointCount
            for (i in 0 until n) {
                val yy = s.y(i) * scale
                if (yy > maxY) maxY = yy
            }
            if (n == 1) {
                paint.strokeWidth = s.width * scale
                canvas.drawPoint(s.x(0) * scale, s.y(0) * scale, paint)
            } else {
                for (i in 0 until n - 1) {
                    val p = (s.pressure(i) + s.pressure(i + 1)) / 2f
                    paint.strokeWidth = max(0.4f, s.width * scale * (0.35f + 0.85f * p))
                    canvas.drawLine(
                        s.x(i) * scale, s.y(i) * scale,
                        s.x(i + 1) * scale, s.y(i + 1) * scale,
                        paint,
                    )
                }
            }
        }
        canvas.restore()
        return min(maxY + 4f, maxHeight)
    }
}
