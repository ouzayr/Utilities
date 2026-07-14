package com.ouzayr.tododiary.model

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.max

/**
 * Portable ink format shared with the web app.
 *
 * JSON shape:
 * ```
 * {
 *   "v": 1,
 *   "cw": 1080.0,                     // canvas width the strokes were written at
 *   "strokes": [
 *     { "c": "#1A237E", "w": 4.0, "p": [x0,y0,p0, x1,y1,p1, ...] }
 *   ]
 * }
 * ```
 * `p` is a flat triplet array (x, y, pressure). Renderers scale x/y by
 * targetWidth / cw. Coordinates are rounded to 0.1 px and pressure to 0.01
 * to keep documents compact.
 */
data class InkStroke(
    val color: String,
    val width: Float,
    /** Flat [x, y, pressure] triplets. */
    val points: FloatArray,
) {
    val pointCount: Int get() = points.size / 3

    fun x(i: Int) = points[i * 3]
    fun y(i: Int) = points[i * 3 + 1]
    fun pressure(i: Int) = points[i * 3 + 2]

    override fun equals(other: Any?): Boolean =
        other is InkStroke && other.color == color && other.width == width && other.points.contentEquals(points)

    override fun hashCode(): Int = 31 * (31 * color.hashCode() + width.hashCode()) + points.contentHashCode()
}

data class InkDocument(
    val canvasWidth: Float,
    val strokes: List<InkStroke>,
) {
    val isEmpty: Boolean get() = strokes.isEmpty()

    fun toJson(): String {
        val root = JSONObject()
        root.put("v", 1)
        root.put("cw", round1(canvasWidth))
        val arr = JSONArray()
        for (s in strokes) {
            val o = JSONObject()
            o.put("c", s.color)
            o.put("w", round1(s.width))
            val p = JSONArray()
            for (i in 0 until s.pointCount) {
                p.put(round1(s.x(i)))
                p.put(round1(s.y(i)))
                p.put(round2(s.pressure(i)))
            }
            o.put("p", p)
            arr.put(o)
        }
        root.put("strokes", arr)
        return root.toString()
    }

    companion object {
        val EMPTY = InkDocument(0f, emptyList())

        fun fromJson(json: String?): InkDocument {
            if (json.isNullOrBlank()) return EMPTY
            return try {
                val root = JSONObject(json)
                val cw = root.optDouble("cw", 0.0).toFloat()
                val arr = root.optJSONArray("strokes") ?: JSONArray()
                val strokes = ArrayList<InkStroke>(arr.length())
                for (i in 0 until arr.length()) {
                    val o = arr.getJSONObject(i)
                    val p = o.optJSONArray("p") ?: JSONArray()
                    val n = p.length() - p.length() % 3
                    val pts = FloatArray(n)
                    for (j in 0 until n) pts[j] = p.getDouble(j).toFloat()
                    strokes.add(
                        InkStroke(
                            color = o.optString("c", "#1A237E"),
                            width = max(0.5f, o.optDouble("w", 4.0).toFloat()),
                            points = pts,
                        )
                    )
                }
                InkDocument(cw, strokes)
            } catch (e: Exception) {
                EMPTY
            }
        }

        // Round in double space so org.json prints "3.6" instead of "3.5999999904632568".
        private fun round1(v: Float): Double = Math.round(v * 10.0) / 10.0
        private fun round2(v: Float): Double = Math.round(v * 100.0) / 100.0
    }
}
