package com.ouzayr.tododiary

import com.ouzayr.tododiary.model.InkDocument
import com.ouzayr.tododiary.model.InkStroke
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class InkModelTest {

    @Test
    fun jsonRoundTripPreservesStrokes() {
        val doc = InkDocument(
            canvasWidth = 1080f,
            strokes = listOf(
                InkStroke("#1A237E", 4f, floatArrayOf(10f, 20f, 0.5f, 30f, 40f, 0.75f)),
                InkStroke("#000000", 2.5f, floatArrayOf(1.15f, 2.24f, 1f)),
            ),
        )
        val parsed = InkDocument.fromJson(doc.toJson())
        assertEquals(1080f, parsed.canvasWidth, 0.01f)
        assertEquals(2, parsed.strokes.size)
        assertEquals("#1A237E", parsed.strokes[0].color)
        assertEquals(2, parsed.strokes[0].pointCount)
        assertEquals(30f, parsed.strokes[0].x(1), 0.11f)
        assertEquals(0.75f, parsed.strokes[0].pressure(1), 0.011f)
        // Rounding: 1.15 -> one decimal for coords
        assertEquals(1.2f, parsed.strokes[1].x(0), 0.06f)
    }

    @Test
    fun emptyAndInvalidJsonAreSafe() {
        assertTrue(InkDocument.fromJson(null).isEmpty)
        assertTrue(InkDocument.fromJson("").isEmpty)
        assertTrue(InkDocument.fromJson("not json").isEmpty)
        assertTrue(InkDocument.fromJson("{}").isEmpty)
    }

    @Test
    fun malformedTripletsAreTruncatedNotCrashing() {
        val json = """{"v":1,"cw":100,"strokes":[{"c":"#000","w":2,"p":[1,2,0.5,7]}]}"""
        val doc = InkDocument.fromJson(json)
        assertEquals(1, doc.strokes[0].pointCount)
    }
}
